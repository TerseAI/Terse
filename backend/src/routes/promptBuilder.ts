import { Request, Response } from 'express';
import { generateQuestions, generatePrompt, GenerateQuestionsRequest, GeneratePromptRequest } from '../utility/promptBuilder';
import { ChannelInput, ChannelOutput } from '../shared/types';
import { ConfigType } from '../shared/Configs';

export async function generateQuestionsRoute(req: Request, res: Response) {
  try {
    const user = req.session?.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { description, existingPrompt, inputConfigs, outputConfig } = req.body as {
      description: string;
      existingPrompt?: string;
      inputConfigs?: Array<{ type: ConfigType; details?: any }>;
      outputConfig?: { type: ConfigType; details?: any };
    };

    if (!description || typeof description !== 'string' || description.trim() === '') {
      return res.status(400).json({ error: 'Description is required' });
    }

    const request: GenerateQuestionsRequest = {
      description: description.trim(),
      existingPrompt,
      inputConfigs,
      outputConfig
    };

    const questions = await generateQuestions(request);
    return res.json({ questions });
  } catch (error: any) {
    console.error('Error generating questions:', error);
    return res.status(500).json({ 
      error: 'Failed to generate questions',
      message: error.message 
    });
  }
}

export async function generatePromptRoute(req: Request, res: Response) {
  try {
    const user = req.session?.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { description, answers, writeInAnswers, existingPrompt, inputConfigs, outputConfig } = req.body as {
      description: string;
      answers: Record<string, string | string[]>;
      writeInAnswers?: Record<string, string>;
      existingPrompt?: string;
      inputConfigs?: Array<{ type: ConfigType; details?: any }>;
      outputConfig?: { type: ConfigType; details?: any };
    };

    if (!description || typeof description !== 'string' || description.trim() === '') {
      return res.status(400).json({ error: 'Description is required' });
    }

    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({ error: 'Answers are required' });
    }

    const request: GeneratePromptRequest = {
      description: description.trim(),
      answers,
      writeInAnswers,
      existingPrompt,
      inputConfigs,
      outputConfig
    };

    const prompt = await generatePrompt(request);
    return res.json({ prompt });
  } catch (error: any) {
    console.error('Error generating prompt:', error);
    return res.status(500).json({ 
      error: 'Failed to generate prompt',
      message: error.message 
    });
  }
}

