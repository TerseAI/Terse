# Investigation: Intelligent Image Processing for PR Screenshots

**Ticket:** TER-XXX (Linked to TER-217)
**Date:** 2026-02-09
**Status:** Investigation Complete

## Executive Summary

This document explores the feasibility of enhancing PR screenshot extraction with intelligent image processing for changelog assets. The goal is to transform full-screen PR screenshots into focused, changelog-ready images that highlight the specific UI changes.

**Key Finding:** This is highly feasible using a combination of Claude's vision capabilities and Node.js image processing libraries. The recommended approach uses a prompt-driven agentic loop with Claude Vision to identify regions of interest, combined with Sharp.js for the actual image transformations.

---

## Current State (TER-217 Context)

### Existing Infrastructure

The Terse platform already has robust infrastructure for handling images:

1. **FileStorageService** (`backend/src/services/FileStorageService.ts`)
   - Complete GCS storage abstraction
   - Supports PNG, JPEG, GIF, WebP, BMP, SVG, TIFF
   - Generates presigned URLs (24-hour expiry)
   - 50MB max file size

2. **Multimodal Content Integration** (`backend/src/agent/AgentRunner/AgentRunner.ts`)
   - `getFiles()` pattern for retrieving images from integrations
   - Converts images to multimodal content for LLM processing
   - Working implementations in Figma, Slack, and Gmail integrations

3. **MCP Screenshot Tools** (Available in Claude Code environment)
   - `mcp__pr-screenshots__upload_screenshot` - Upload to persistent storage
   - `mcp__pr-screenshots__post_screenshot_to_pr` - Post to GitHub PRs

### Gap

While TER-217 covers extracting screenshots from PRs, there's no current capability to:
- Intelligently crop/focus screenshots on relevant UI areas
- Process images based on prompts describing desired output
- Generate animated GIFs highlighting UI changes

---

## Proposed Approaches

### Approach 1: Claude Vision + Sharp.js (Recommended)

**How it works:**

1. Agent receives full-screen PR screenshot
2. Claude Vision analyzes the image with a prompt like:
   > "Identify the bounding box (normalized 0-1 coordinates) of the main UI change in this screenshot. Focus on [specific feature from PR description]."
3. Claude returns coordinates: `{ x1: 0.2, y1: 0.1, x2: 0.8, y2: 0.6 }`
4. Sharp.js crops the image to those coordinates
5. Optionally: Add subtle annotations/highlights

**Pros:**
- Leverages Claude's existing vision capabilities
- Anthropic provides a documented [crop tool pattern](https://github.com/anthropics/anthropic-cookbook) using normalized coordinates
- Prompt-driven = flexible, no hardcoded heuristics
- Sharp.js is fast, mature, and already Node.js-native

**Cons:**
- Claude Vision has known limitations with precise bounding box coordinates
- Requires additional API calls (adds latency and cost)
- May need iterative refinement for accuracy

**Implementation complexity:** Medium

### Approach 2: Smartcrop.js + Sharp.js (Heuristic-Based)

**How it works:**

1. Use [smartcrop-sharp](https://github.com/jwagner/smartcrop-sharp) to auto-detect regions of interest
2. Smartcrop uses Shannon entropy and attention strategies (face detection, color saturation, luminance)
3. Sharp handles the actual cropping

**Pros:**
- No LLM calls required (faster, cheaper)
- smartcrop.js has proven algorithms for "interesting" region detection
- Can use "boost" regions if we know approximate locations

**Cons:**
- Not prompt-driven - can't specify what to focus on
- May not understand UI/UX context (buttons, modals, etc.)
- Less flexible for changelog-specific requirements

**Implementation complexity:** Low

### Approach 3: Puppeteer Element Screenshots (Screenshot-Time)

**How it works:**

1. Instead of cropping after-the-fact, capture targeted screenshots at PR review time
2. Use Puppeteer's `element.boundingBox()` + `page.screenshot({ clip })` to capture specific elements
3. Agent can be instructed: "Screenshot the new button added in this PR"

**Pros:**
- Perfect precision - no post-hoc guessing
- Can capture specific elements by CSS selector
- Integrates with existing browser automation

**Cons:**
- Requires live browser session with the deployed PR preview
- Doesn't work for already-captured screenshots
- Needs knowledge of DOM structure

**Implementation complexity:** Medium (requires PR preview deployment)

### Approach 4: Animated GIF Generation

**How it works:**

1. Start with full screenshot
2. Generate frames that progressively zoom into the region of interest
3. Optionally add highlight/annotation frames
4. Compile into animated GIF using:
   - ImageMagick's `-distort SRT` for zoom frames
   - FFmpeg for GIF compilation
   - Or pure Sharp.js with gif-encoder

**Pros:**
- Eye-catching for changelogs
- Shows context (full screen) then detail (zoomed area)
- Can include pause on the highlight

**Cons:**
- Larger file sizes
- More complex pipeline
- May be excessive for simple UI changes

**Implementation complexity:** High

---

## Technical Considerations

### Claude Vision Limitations

From testing and documentation:

1. **Coordinate Accuracy:** Claude Vision can identify regions but struggles with pixel-perfect bounding boxes. Testing shows coordinates vary between runs.

2. **Image Size Limits:**
   - Max: 8000x8000 px (2000x2000 if >20 images)
   - Auto-scales if long edge > 1568px
   - ~1600 tokens per image

3. **The Crop Tool Pattern:** Anthropic's cookbook demonstrates an agentic loop where Claude can request crops to "zoom in" for detail:
   ```
   Tool: crop_image
   Parameters: { x1: 0.0, y1: 0.0, x2: 0.3, y2: 0.3 }
   ```
   This pattern could be inverted - instead of Claude requesting crops, we ask Claude for the crop coordinates.

### Sharp.js Capabilities

Sharp (wrapper around libvips) provides:

```javascript
// Smart cropping strategies
sharp(input)
  .resize(800, 600, {
    fit: 'cover',
    position: sharp.strategy.attention // or entropy
  })
  .toFile('output.jpg');

// Exact region extraction
sharp(input)
  .extract({ left: 100, top: 50, width: 400, height: 300 })
  .toFile('cropped.jpg');

// Compositing for annotations
sharp(input)
  .composite([{ input: highlightOverlay, top: 50, left: 100 }])
  .toFile('annotated.jpg');
```

### Tool/Skill Design

A potential ImageMagick-like skill for agents:

```typescript
interface ImageProcessingTool {
  name: "processScreenshot";
  parameters: {
    imageUrl: string;
    operation: "crop" | "highlight" | "zoom_gif";
    region?: { x1: number; y1: number; x2: number; y2: number }; // normalized 0-1
    prompt?: string; // e.g., "Focus on the new settings panel"
    outputFormat?: "png" | "jpg" | "gif";
  };
}
```

---

## Recommended Implementation Path

### Phase 1: Prompt-Driven Cropping (MVP)

1. Add `sharp` to backend dependencies
2. Create `ImageProcessingService` with:
   - `cropToRegion(imageUrl, region)` - basic crop
   - `analyzeAndCrop(imageUrl, prompt)` - Claude Vision + crop
3. Expose as a tool for changelog generation agents
4. Store processed images via existing `FileStorageService`

### Phase 2: Enhanced Processing

1. Add annotation capabilities (borders, arrows, highlights)
2. Implement smartcrop fallback for when prompts aren't provided
3. Add zoom animation GIF generation

### Phase 3: Integration

1. Integrate with PR screenshot extraction (TER-217)
2. Auto-process screenshots when generating changelogs
3. Allow manual prompt refinement in changelog UI

---

## Limitations & Risks

1. **Vision Accuracy:** Claude may not always identify the "right" region. Mitigation: Allow human review and manual cropping fallback.

2. **Performance:** Claude Vision calls add ~2-5 seconds per image. Mitigation: Process asynchronously, cache results.

3. **Cost:** Additional API calls for vision analysis. Mitigation: Use smartcrop for simple cases, Vision for complex.

4. **GIF Complexity:** Animated outputs are significantly more complex. Mitigation: Start with static cropped images, add GIF later.

---

## Proof of Concept Outline

A minimal PoC would:

1. Accept a screenshot URL and a focus prompt
2. Send to Claude Vision: "What are the normalized bounding box coordinates (x1, y1, x2, y2 as 0-1 values) for: [prompt]?"
3. Parse the response coordinates
4. Use Sharp to extract that region
5. Return the cropped image URL

```typescript
async function focusCrop(imageUrl: string, focusPrompt: string): Promise<string> {
  // 1. Ask Claude for coordinates
  const response = await claude.messages.create({
    model: "claude-sonnet-4-20250514",
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "url", url: imageUrl } },
        { type: "text", text: `Identify the bounding box for: ${focusPrompt}. Return JSON: { x1, y1, x2, y2 } with values 0-1.` }
      ]
    }]
  });

  // 2. Parse coordinates
  const coords = JSON.parse(response.content[0].text);

  // 3. Crop with Sharp
  const imageBuffer = await fetch(imageUrl).then(r => r.arrayBuffer());
  const metadata = await sharp(imageBuffer).metadata();

  const cropped = await sharp(imageBuffer)
    .extract({
      left: Math.floor(coords.x1 * metadata.width),
      top: Math.floor(coords.y1 * metadata.height),
      width: Math.floor((coords.x2 - coords.x1) * metadata.width),
      height: Math.floor((coords.y2 - coords.y1) * metadata.height)
    })
    .toBuffer();

  // 4. Upload and return URL
  return await fileStorageService.upload(cropped);
}
```

---

## Conclusion

Intelligent image processing for PR screenshots is **feasible and valuable**. The recommended approach combines:

1. **Claude Vision** for understanding what to focus on (prompt-driven)
2. **Sharp.js** for fast, reliable image manipulation
3. **Existing FileStorageService** for storage

This approach is flexible enough to handle varied changelog requirements while leveraging existing infrastructure. The main uncertainty is Claude Vision's coordinate accuracy, which can be mitigated through iterative refinement and human review fallbacks.

**Next Steps:**
1. Build a minimal PoC to test Vision coordinate accuracy
2. Add Sharp to backend dependencies
3. Create `ImageProcessingService` with basic crop functionality
4. Integrate with changelog generation workflow

---

## Sources

- [Anthropic Cookbook - Crop Tool Pattern](https://github.com/anthropics/anthropic-cookbook)
- [Sharp.js Documentation](https://sharp.pixelplumbing.com/api-resize/)
- [smartcrop-sharp](https://github.com/jwagner/smartcrop-sharp)
- [smartcrop.js](https://github.com/jwagner/smartcrop.js)
- [ImageMagick Zoom Animation Scripts](https://imagemagick.org/script/command-line-options.php)
