/**
 * GenAI tracking — prompts and traces.
 */

import type { Level } from '../engine/types';
import {
  all,
  runHasEval,
  runHasPrompt,
  runHasTrace,
} from '../engine/goals';
import { withExperiment } from './builders';

export const genaiLevels: Level[] = [
  {
    id: 'ai-prompt',
    sequenceId: 'genai',
    name: 'Log Prompts',
    about: 'Prompts are parameters for LLM systems.',
    hint: 'mlflow genai log-prompt "You are a concise tutor..."',
    solutionCommand:
      'mlflow runs create --name prompt-v1; mlflow genai log-prompt "You are a concise tutor. Explain MLflow stages."; mlflow genai log-prompt "Rewrite for a junior MLE."',
    startWorld: withExperiment('tutor-bot'),
    goal: runHasPrompt('tutor-bot'),
    learning: [
      'Prompts are versioned parameters, not chat secrets',
      'Log prompt variants as you would hyperparameters',
    ],
    goalSteps: ['Log at least one prompt on a run in tutor-bot'],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## The prompt is the hyperparameter',
          '',
          'In classical ML you tune `lr`. In LLM systems you tune **prompt text** (and temperature, tools, retrieval). If the prompt is not on the run, you cannot A/B it or roll it back.',
          '',
          '```',
          'mlflow genai log-prompt "You are a concise tutor. Explain MLflow stages."',
          '```',
          '',
          'Treat prompt templates like code: review them, version them, and never paste production prompts only into a chat UI.',
        ],
      },
      {
        type: 'text',
        markdown: ['Log one or more prompts on a run in `tutor-bot`.'],
      },
    ],
  },
  {
    id: 'ai-traces',
    sequenceId: 'genai',
    name: 'Traces',
    about: 'LLM calls are multi-span workflows.',
    hint: 'mlflow genai log-trace --name llm-call --kind LLM',
    solutionCommand:
      'mlflow runs create --name rag; mlflow genai log-prompt "What is Model Registry?"; mlflow genai log-trace --name retrieve --kind RETRIEVER; mlflow genai log-trace --name llm-call --kind LLM',
    startWorld: withExperiment('tutor-bot'),
    goal: all(
      runHasPrompt('tutor-bot'),
      runHasTrace('RETRIEVER', 'tutor-bot'),
      runHasTrace('LLM', 'tutor-bot'),
    ),
    learning: [
      'Traces capture retrieval + LLM + tool spans',
      'Debug RAG with traces, not print statements',
    ],
    goalSteps: [
      'Log a prompt',
      'Log a RETRIEVER trace span',
      'Log an LLM trace span',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## One question, many spans',
          '',
          'A RAG answer is a **trace**: retrieve → prompt → model → parse. Logging only the final string hides which span broke (empty retrieval? prompt drift? model refusal?).',
          '',
          '```',
          'mlflow genai log-trace --name retrieve --kind RETRIEVER',
          'mlflow genai log-trace --name llm-call --kind LLM',
          '```',
          '',
          'When latency spikes or quality drops, traces are the primary evidence. Make span logging part of the chain wrapper, not a debug flag.',
        ],
      },
      {
        type: 'text',
        markdown: [
          'On one run: a prompt, a `RETRIEVER` trace, and an `LLM` trace.',
        ],
      },
    ],
  },
  {
    id: 'ai-eval',
    sequenceId: 'genai',
    name: 'LLM Evaluation',
    about: 'Score groundedness and helpfulness explicitly.',
    hint: 'mlflow evaluate --metric faithfulness --value 0.88',
    solutionCommand:
      'mlflow runs create --name eval-rag; mlflow genai log-prompt "Explain stages."; mlflow genai log-trace --name llm-call --kind LLM; mlflow evaluate --metric faithfulness --value 0.88; mlflow evaluate --metric helpfulness --value 0.84',
    startWorld: withExperiment('tutor-bot'),
    goal: all(
      runHasPrompt('tutor-bot'),
      runHasEval('faithfulness', 0.8),
      runHasEval('helpfulness', 0.8),
    ),
    learning: [
      'LLM quality needs named eval dimensions',
      'Faithfulness and helpfulness are release gates too',
    ],
    goalSteps: [
      'Log a prompt on a run',
      'Evaluate faithfulness >= 0.8',
      'Evaluate helpfulness >= 0.8',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## “Looks fine” is not a metric',
          '',
          'LLM systems need quantitative gates: **faithfulness** (is it grounded?), **helpfulness**, toxicity, cost, latency. Log them with `mlflow.evaluate` so promotion rules apply the same way as classical models.',
          '',
          '```',
          'mlflow evaluate --metric faithfulness --value 0.88',
          'mlflow evaluate --metric helpfulness --value 0.84',
          '```',
          '',
          'Human spot-checks remain useful — but the Registry gate should read numbers off the run.',
        ],
      },
      {
        type: 'text',
        markdown: [
          'Prompt + evaluate `faithfulness` ≥ 0.8 and `helpfulness` ≥ 0.8.',
        ],
      },
    ],
  },
];
