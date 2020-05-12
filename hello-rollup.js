import svelte from 'rollup-plugin-svelte'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
// import livereload from 'rollup-plugin-livereload'
import { terser } from 'rollup-plugin-terser'

const production = !process.env.ROLLUP_WATCH
const name = 'HelloWord'
const sourcemap = true

export default {
  input: 'hello.js',
  output: {
    sourcemap,
    format: 'iife',
    name,
    file: '../dist/hello-svelte.js'
  },
  plugins: [
    svelte({
      dev: !production,
      //customElement: true,
      hydratable: true,
      css: css => css.write('../dist/hello-svelte.css')
    }),

    resolve({ // npm dependencies - https://github.com/rollup/plugins/tree/master/packages/commonjs
      browser: true,
      dedupe: ['svelte']
    }),
    commonjs(),
    !production && serve(),
    //! production && livereload('public'),
    production && terser()
  ],
  watch: { clearScreen: false }
}

function serve () {
  let started = false

  return {
    writeBundle () {
      if (!started) {
        started = true

        require('child_process').spawn('npm', ['run', 'start', '--', '--dev'], {
          stdio: ['ignore', 'inherit', 'inherit'],
          shell: true
        })
      }
    }
  }
}
