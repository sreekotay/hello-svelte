<svelte:options tag="hello-element"/>

<script>
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  function sayHello() {
    dispatch('helloMessage', {
      helloThing: 'Hello!'
    });
  }
  let name = 'world';
  export let exclamation = ':)'
</script>

<h3><a on:click={sayHello} href='#'>Hello</a> {name}{exclamation}
  <slot name='helloSlot'></slot>
</h3>