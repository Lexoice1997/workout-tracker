import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@angular/*', '@nestjs/*', '@supabase/*', '@web/*'],
              message:
                'libs/domain — чистый TS: без фреймворков, Supabase и кода приложения',
            },
          ],
        },
      ],
    },
  },
];
