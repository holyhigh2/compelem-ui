import json from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import livereload from 'rollup-plugin-livereload';
import scss from 'rollup-plugin-scss';
import serve from 'rollup-plugin-serve';
import typescript from 'rollup-plugin-typescript2';
const pkg = require('./package.json');

export default [{
  input: 'src/index.ts',
  output: {
    file: 'test/compelem-ui.js',
    format: 'umd',
    name: 'compelemui',
    banner: `/* ${pkg.name} ${pkg.version} @${pkg.author} ${pkg.repository.url} */`,
  },
  plugins: [
    nodeResolve(),
    typescript({
      clean: true,
      useTsconfigDeclarationDir: true,
      tsconfigOverride: {
        compilerOptions: {
          // declarationDir: './dist/types',
        },
      },
    }),
    scss({ output: false }),
    serve({
      open: true,
      port: 8818,
      openPage: '/test/login.html',
      host: 'localhost',
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    }),
    livereload('src'),
    json(),
  ],
},
{
  input: 'src/css/output.ts',
  plugins: [
    scss({ output: 'test/root.css' }),
    json(),
  ]
}
];
