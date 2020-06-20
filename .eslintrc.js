module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: [
      './terrain/tsconfig.json'
    ],
    ecmaVersion: 2018,
    sourceType: 'module'
  },
  plugins: [
    '@typescript-eslint',
    'editorconfig'
  ],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'prettier/@typescript-eslint'
  ],
  env: {
    node: true,
    browser: true
  },
  settings: {},
  rules: {
    "semi": "error",
    "brace-style": ["error", "stroustrup"],
    "editorconfig/editorconfig": "error",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/interface-name-prefix": ["error", { "prefixWithI": "always" }],
    "@typescript-eslint/no-non-null-assertion": "off"
  },
  "env": {
    "jest": true
  }
};
