<svelte:options tag="hello2-element"/>

<script>
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  function sayHello() {
    dispatch('hello2-Message', {
      helloThing: 'Hello2!'
    });
  }
  let name = 'world';
  export let exclamation = ':)'
</script>

<h3><a on:click={sayHello} href='#'>Hello2</a> {name}{exclamation}
  <slot name='helloSlot'></slot>
</h3>