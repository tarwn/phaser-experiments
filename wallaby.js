module.exports = function (wallaby) {
  return {
    files: [
      'src/**/*.ts',
      '!node_modules/**/',
      '!src/**/*.spec.ts'
    ],
    tests: [
      'src/**/*.spec.ts'
    ],

    compilers: {
      'src/**/*.ts': wallaby.compilers.typeScript({
        isolatedModules: true
      })
    },
    env: {
      type: 'node',
      runner: 'node'
    },
    testFramework: 'jest',
    debug: true,
    setup: function (wallaby) {
      var jestConfig = require(wallaby.localProjectDir + '/jest.config.js');
      jestConfig.moduleDirectories = [
        'node_modules'
      ];
      wallaby.testFramework.configure(jestConfig);
    },
  };
};
