import { Request, Response } from 'express';
import { generateSurveyQuestions } from '../agent/userPromptBuilder/generateSurveyQuestions';
import { generateSurveyPrompt } from '../agent/userPromptBuilder/generateSurveyPrompt';
import { GenerateSurveyQuestionsRequest, GenerateSurveyPromptRequest, GenerateSurveyQuestionsResponse, GenerateSurveyPromptResponse } from '../shared/PromptBuilderTypes';

export async function generateQuestionsRoute(req: Request, res: Response) {
  try {
    const user = req.session?.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { description, existingPrompt, inputConfigs, outputConfig } = req.body as GenerateSurveyQuestionsRequest;

    if (!description || typeof description !== 'string' || description.trim() === '') {
      return res.status(400).json({ error: 'Description is required' });
    }

    const request: GenerateSurveyQuestionsRequest = {
      description: description.trim(),
      existingPrompt,
      inputConfigs,
      outputConfig
    };

    const questions = await generateSurveyQuestions(request);
    const response: GenerateSurveyQuestionsResponse = { questions };
    return res.json(response);
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

    const { description, answers, writeInAnswers, existingPrompt, inputConfigs, outputConfig } = req.body as GenerateSurveyPromptRequest;

    if (!description || typeof description !== 'string' || description.trim() === '') {
      return res.status(400).json({ error: 'Description is required' });
    }

    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({ error: 'Answers are required' });
    }

    const request: GenerateSurveyPromptRequest = {
      description: description.trim(),
      answers,
      writeInAnswers,
      existingPrompt,
      inputConfigs,
      outputConfig
    };

    const prompt = await generateSurveyPrompt(request);
    const response: GenerateSurveyPromptResponse = { prompt };
    return res.json(response);
  } catch (error: any) {
    console.error('Error generating prompt:', error);
    return res.status(500).json({ 
      error: 'Failed to generate prompt',
      message: error.message 
    });
  }
}

