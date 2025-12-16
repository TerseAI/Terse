import { Request, Response } from 'express';
import { generateSurveyQuestions } from '../agent/userPromptBuilder/generateSurveyQuestions';
import { generateSurveyPrompt } from '../agent/userPromptBuilder/generateSurveyPrompt';
import { GenerateSurveyQuestionsRequest, GenerateSurveyPromptRequest, GenerateSurveyQuestionsResponse, GenerateSurveyPromptResponse } from '../shared/PromptBuilderTypes';
import logger from '../logger';

export async function generateQuestionsRoute(req: Request, res: Response) {
  try {
    const user = req.session?.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const body = req.body as GenerateSurveyQuestionsRequest;

    if (!body.description || typeof body.description !== 'string' || body.description.trim() === '') {
      return res.status(400).json({ error: 'Description is required' });
    }

    const questions = await generateSurveyQuestions({
      description: body.description.trim(),
      existingPrompt: body.existingPrompt,
      inputConfigs: body.inputConfigs,
      outputConfig: body.outputConfig
    });

    return res.json({ questions });
  } catch (error: any) {
    logger.error('Error generating questions:', error);
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

    const body = req.body as GenerateSurveyPromptRequest;

    if (!body.description || typeof body.description !== 'string' || body.description.trim() === '') {
      return res.status(400).json({ error: 'Description is required' });
    }

    if (!body.questions || !Array.isArray(body.questions) || body.questions.length === 0) {
      return res.status(400).json({ error: 'Questions are required' });
    }

    if (!body.answers || typeof body.answers !== 'object') {
      return res.status(400).json({ error: 'Answers are required' });
    }

    const prompt = await generateSurveyPrompt({
      description: body.description.trim(),
      questions: body.questions,
      answers: body.answers,
      writeInAnswers: body.writeInAnswers,
      existingPrompt: body.existingPrompt,
      inputConfigs: body.inputConfigs,
      outputConfig: body.outputConfig
    });

    return res.json({ prompt });
  } catch (error: any) {
    logger.error('Error generating prompt:', error);
    return res.status(500).json({ 
      error: 'Failed to generate prompt',
      message: error.message 
    });
  }
}

