import React, { createContext, useContext, useState, useRef, useEffect } from "react";
import { Type } from "../utility/Types";

interface SnippetRef {
  turnIndex: number;
  itemIndex: number;
  type: Type;
  id: number;
  element: HTMLElement | null;
  turnId: string;
  isGenerating: boolean;
  role: "user" | "assistant";
}

interface SnippetNavigationContextType {
  // Current state
  selectedSnippetIndex: number | null;
  availableSnippets: SnippetRef[];

  // Actions
  selectSnippet: (index: number) => void;
  selectNextSnippet: () => void;
  selectPreviousSnippet: () => void;
  openSelectedSnippet: () => void;
  clearSelection: () => void;

  // Registration
  registerSnippet: (snippet: Omit<SnippetRef, "element">) => number;
  updateSnippetElement: (index: number, element: HTMLElement | null) => void;
  clearSnippets: () => void;

  // Callback for when Enter is pressed
  onSnippetSelect?: (snippet: SnippetRef) => void;
}

const SnippetNavigationContext = createContext<SnippetNavigationContextType | null>(null);

export function useSnippetNavigation(onSnippetSelect?: (snippet: SnippetRef) => void) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [snippets, setSnippets] = useState<SnippetRef[]>([]);
  const nextIndexRef = useRef(0);
  const onSnippetSelectRef = useRef(onSnippetSelect);
  const selectedIndexRef = useRef<number | null>(null);

  // Update the ref when selectedIndex changes
  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  // Update the ref when the callback changes
  useEffect(() => {
    onSnippetSelectRef.current = onSnippetSelect;
  }, [onSnippetSelect]);

  const selectNext = () => {
    if (snippets.length === 0) {
      return;
    }
    setSelectedIndex((prev) => {
      if (prev === null) {
        return 0; // Start from first element
      }
      if (prev >= snippets.length - 1) {
        return null; // Deselect when going past the last element
      }
      return prev + 1;
    });
  };

  const selectPrevious = () => {
    if (snippets.length === 0) {
      return;
    }
    setSelectedIndex((prev) => {
      if (prev === null) {
        return snippets.length - 1; // Start from last element
      }
      if (prev <= 0) {
        return null; // Deselect when going past the first element
      }
      return prev - 1;
    });
  };

  const openSelected = () => {
    if (selectedIndexRef.current !== null && selectedIndexRef.current < snippets.length) {
      const snippet = snippets[selectedIndexRef.current];
      onSnippetSelectRef.current?.(snippet);
      setSelectedIndex(null);
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    // Only handle arrow keys, Enter, and Escape for navigation
    // Let all other keys pass through normally for typing
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        selectNext();
        break;
      case "ArrowUp":
        event.preventDefault();
        selectPrevious();
        break;
      case "Enter":
        // Only handle Enter if we have a selected snippet
        if (selectedIndexRef.current !== null) {
          event.preventDefault();
          openSelected();
        }
        break;
      case "Escape":
        event.preventDefault();
        setSelectedIndex(null);
        break;
      default:
        // Let all other keys pass through normally
        return;
    }
  };

  const registerSnippet = (snippet: Omit<SnippetRef, "element">) => {
    const index = nextIndexRef.current;
    setSnippets((prev) => [...prev, { ...snippet, element: null }]);
    nextIndexRef.current++;
    return index;
  };

  const clearSnippets = () => {
    setSnippets([]);
    nextIndexRef.current = 0;
    setSelectedIndex(null);
  };

  const updateSnippetElement = (index: number, element: HTMLElement | null) => {
    setSnippets((prev) =>
      prev.map((snippet, i) => (i === index ? { ...snippet, element } : snippet))
    );
  };

  const clearSelection = () => {
    setSelectedIndex(null);
  };

  const selectSnippet = (index: number) => {
    if (index >= 0 && index < snippets.length) {
      setSelectedIndex(index);
    }
  };

  // Scroll selected snippet into view
  useEffect(() => {
    if (selectedIndex !== null && selectedIndex < snippets.length) {
      const snippet = snippets[selectedIndex];
      if (snippet.element) {
        snippet.element.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }
    }
  }, [selectedIndex, snippets]);

  return {
    selectedSnippetIndex: selectedIndex,
    availableSnippets: snippets,
    selectSnippet,
    selectNextSnippet: selectNext,
    selectPreviousSnippet: selectPrevious,
    openSelectedSnippet: openSelected,
    clearSelection,
    registerSnippet,
    updateSnippetElement,
    clearSnippets,
    onSnippetSelect,
    handleKeyDown,
  };
}

export function SnippetNavigationProvider({
  children,
  onSnippetSelect,
}: {
  children: React.ReactNode;
  onSnippetSelect?: (snippet: SnippetRef) => void;
}) {
  const navigation = useSnippetNavigation(onSnippetSelect);

  // Add global keyboard listener
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      navigation.handleKeyDown(event);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [navigation]);

  return (
    <SnippetNavigationContext.Provider value={navigation}>
      {children}
    </SnippetNavigationContext.Provider>
  );
}

export function useSnippetNavigationContext() {
  const context = useContext(SnippetNavigationContext);
  if (!context) {
    throw new Error("useSnippetNavigationContext must be used within a SnippetNavigationProvider");
  }
  return context;
}
