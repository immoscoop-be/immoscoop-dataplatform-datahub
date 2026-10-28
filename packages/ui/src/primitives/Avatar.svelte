<script lang="ts">
  /**
   * The initials of a User: small at the foot of the rail, where they open My page and carry a ring
   * while it is open (DEC-UX-84), large on My page itself, or mini next to what they did, on a tile.
   */
  let {
    initials,
    size = 'small',
    href,
    active = false,
    label,
    onclick,
  }: {
    initials: string;
    size?: 'mini' | 'small' | 'large';
    href?: string;
    active?: boolean;
    label?: string;
    onclick?: (event: MouseEvent) => void;
  } = $props();
</script>

{#if href}
  <a class="avatar {size}" class:active {href} aria-label={label} aria-current={active ? 'page' : undefined} {onclick}>{initials}</a>
{:else}
  <span class="avatar {size}" aria-hidden="true">{initials}</span>
{/if}

<style>
  .avatar { display: flex; align-items: center; justify-content: center; border-radius: 50%; font-weight: var(--weight-medium); flex: none; }
  .small { width: 34px; height: 34px; margin-top: 6px; background: var(--surface-glass); font-size: var(--text-meta); }
  .large { width: 56px; height: 56px; background: var(--surface-sub); font-size: 18px; }
  .mini { width: 20px; height: 20px; background: var(--tint-active); color: var(--text-secondary); font-size: 8px; }
  a.avatar { color: var(--text-primary); text-decoration: none; cursor: pointer; transition: box-shadow var(--motion-ring); }
  a.avatar:hover { box-shadow: 0 0 0 2px var(--tint-hover); }
  a.avatar.active { box-shadow: 0 0 0 2px var(--text-primary); }
</style>
