import { Module } from '@nestjs/common';
import { LLM_PROVIDER } from './llm-provider.interface';
import { GroqProvider } from './groq.provider';
@Module({
  providers: [
    {
      provide: LLM_PROVIDER,
      useFactory: () => {
        const provider = process.env.LLM_PROVIDER?.trim() || 'groq';
        if (provider !== 'groq') throw new Error('Unsupported LLM_PROVIDER');
        return new GroqProvider();
      },
    },
  ],
  exports: [LLM_PROVIDER],
})
export class LlmModule {}
