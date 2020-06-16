module.exports = function (wallaby) {
  return {
    files: [
      'terrain/src/**/*',
      '!terrain/src/**/*.spec.ts',
      '!terrain/src/typings/*.ts'
    ],
    tests: [
      'terrain/src/**/*.spec.ts'
    ],

    compilers: {
      'terrain/src/**/*.ts': wallaby.compilers.typeScript({
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
        'node_modules',
        '<rootdir>/terrain/node_modules'
      ];
      wallaby.testFramework.configure(jestConfig);
    },
    trace: true
  };
};
