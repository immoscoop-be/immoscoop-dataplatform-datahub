import { Alert, Box, Button, Center, Stack, Text, Title } from '@mantine/core';
import { brand, BrandMark } from '@datahub/ui';

export interface SignInProps {
  /** Why the last sign-in did not work, as a sentence for the User. */
  problem?: string;
}

/** The page for a User without a session: one button, to Google through identity. */
export function SignIn({ problem }: SignInProps) {
  return (
    <Box pos="relative" mih="100vh" style={{ overflow: 'hidden' }}>
      {/* Two overlapping circles, the basic shape of the brand, behind the page. */}
      <Box pos="absolute" top={-160} right={-120} w={420} h={420} bg={brand.lightPink} style={{ borderRadius: '50%' }} aria-hidden />
      <Box pos="absolute" top={40} right={140} w={260} h={260} style={{ borderRadius: '50%', border: `14px solid ${brand.magenta}` }} aria-hidden />
      <Center mih="100vh" px="md" pos="relative">
        <Stack align="center" gap="lg" maw={420} ta="center">
          <BrandMark size={56} />
          <Stack gap={4}>
            <Title order={1}>Data Hub</Title>
            <Text c="dimmed">The library of our data.</Text>
          </Stack>
          {problem && (
            <Alert color="magenta" variant="light" title="You are not signed in" w="100%" ta="left">
              {problem}
            </Alert>
          )}
          <Button component="a" href="/auth/login" size="md" radius="xl" px="xl">
            Sign in with Google
          </Button>
          <Text size="xs" c="dimmed">
            With your account of the company.
          </Text>
        </Stack>
      </Center>
    </Box>
  );
}
