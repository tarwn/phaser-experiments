module.exports = function (wallaby) {
  return {
    files: [
      // 'terrain/src/**/*',
      // '!terrain/src/**/*.spec.ts',
      // '!terrain/src/typings/*.ts',
      'water/src/**/*',
      '!water/src/**/*.spec.ts',
      '!water/src/typings/*.ts'
    ],
    tests: [
      // 'terrain/src/**/*.spec.ts',
      'water/src/**/*.spec.ts'
    ],

    compilers: {
      // 'terrain/src/**/*.ts': wallaby.compilers.typeScript({
      //   isolatedModules: true
      // }),
      'water/src/**/*.ts': wallaby.compilers.typeScript({
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
        // '<rootdir>/terrain/node_modules',
        '<rootdir>/water/node_modules'
      ];
      wallaby.testFramework.configure(jestConfig);
    },
    trace: true
  };
};
