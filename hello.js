import Hello from './hello.svelte'
import Hello2 from './hello2.svelte'

/* old way
new Hello({
  target: document.querySelector('#hello')
})
*/

// exported to global space
window.Hello = (opts) => new Hello(opts)
window.Hello2 = (opts) => new Hello2(opts)
