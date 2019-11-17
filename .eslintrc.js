module.exports = {
    parser: 'babel-eslint',
  
    extends: [
      'prettier'
    ],
  
    plugins: ['prettier'],
    parserOptions: {
      "sourceType": "module",
      "allowImportExportEverywhere": false,
      "codeFrame": true
    },
    globals: {
      __DEV__: true,
      __DEVBANNER__: false,
      __APP__: false,
    },
  
    env: {
      browser: true,
      es6: true
    },
  
    rules: {
  
      'no-undef-init': 'off',
      'no-return-await': 'off',
      'no-nested-ternary': 'off',
      'no-plusplus': 'off',
      'consistent-return': 'off',
      'no-restricted-globals': 'off',
      'no-param-reassign': 'off',
      'prettier/prettier': [
        'error',
        {
          parser: 'babel',
          useTabs: false,
          semi: false,
          singleQuote: true,
          trailingComma: 'all',
          bracketSpacing: true,
          arrowParens: 'avoid',
          tabWidth: 4,
          printWidth: 100,
        },
      ],
    }
  };