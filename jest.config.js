module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  verbose: true,
  setupFiles: [
    "jest-canvas-mock"
  ],
  setupFilesAfterEnv: [ ]
};
