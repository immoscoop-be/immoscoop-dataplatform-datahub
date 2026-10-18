import { Anchor, Avatar, Badge, Box, Container, Group, Menu, Text, UnstyledButton } from '@mantine/core';
import { BrandMark } from '@datahub/ui';
import type { ReactNode } from 'react';
import type { Me } from './api.js';
import { SignOutIcon } from './icons.js';

export interface ShellProps {
  me: Me;
  onSignOut: () => void;
  children: ReactNode;
}

/** The frame of every page for a signed-in User: the bar with the mark and the User, then the page. */
export function Shell({ me, onSignOut, children }: ShellProps) {
  return (
    <>
      <Box component="header" bg="white" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
        <Container size="lg" h={64}>
          <Group h="100%" justify="space-between">
            <Anchor href="#/" underline="never" c="bordeaux.6" aria-label="Data Hub, to the search">
              <Group gap="xs">
                <BrandMark />
                <Text fw={600} size="lg" inherit>
                  Data Hub
                </Text>
              </Group>
            </Anchor>
            <UserMenu me={me} onSignOut={onSignOut} />
          </Group>
        </Container>
      </Box>
      <Box component="main">
        <Container size="lg" py={48}>
          {children}
        </Container>
      </Box>
    </>
  );
}

function UserMenu({ me, onSignOut }: Omit<ShellProps, 'children'>) {
  return (
    <Menu position="bottom-end" width={280} shadow="md">
      <Menu.Target>
        <UnstyledButton aria-label={`${me.name}, the menu of your account`}>
          <Group gap="sm">
            <Text size="sm" visibleFrom="sm">
              {me.name}
            </Text>
            <Avatar name={me.name} color="magenta" radius="xl" size="md" />
          </Group>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Box px="sm" py="xs">
          <Text size="sm" fw={600}>
            {me.name}
          </Text>
          <Text size="xs" c="dimmed">
            {me.email}
          </Text>
          <Group gap={6} mt="sm">
            {me.roles.length > 0 ? (
              me.roles.map((role) => (
                <Badge key={role} variant="light" color="teal" size="sm">
                  {role}
                </Badge>
              ))
            ) : (
              <Text size="xs" c="dimmed">
                No roles
              </Text>
            )}
          </Group>
        </Box>
        <Menu.Divider />
        <Menu.Item leftSection={<SignOutIcon size={16} />} onClick={onSignOut}>
          Sign out
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
