import { Kbd, Modal, Stack, Table, Text } from '@mantine/core';
import { SHORTCUT_GROUPS } from '../../lib/shortcuts';

interface ShortcutCheatsheetProps {
  opened: boolean;
  onClose: () => void;
}

export default function ShortcutCheatsheet({ opened, onClose }: ShortcutCheatsheetProps) {
  return (
    <Modal opened={opened} onClose={onClose} title="快捷键" size={520} centered>
      <Stack gap="lg">
        {SHORTCUT_GROUPS.map((group) => (
          <div key={group.title}>
            <Text size="sm" fw={600} mb="xs">{group.title}</Text>
            <Table>
              <Table.Tbody>
                {group.items.map((item) => (
                  <Table.Tr key={item.label}>
                    <Table.Td>{item.label}</Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Kbd>{item.keys}</Kbd>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </div>
        ))}
      </Stack>
    </Modal>
  );
}
