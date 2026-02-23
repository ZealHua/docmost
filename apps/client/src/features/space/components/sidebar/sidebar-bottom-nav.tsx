import { Group, ActionIcon, Tooltip, Menu, UnstyledButton, Popover, Button, Text } from "@mantine/core";
import {
  IconChevronDown,
  IconChevronUp,
  IconSettings,
  IconUsers,
  IconUserCircle,
  IconBrush,
  IconLogout,
  IconBrightnessFilled,
  IconSun,
  IconMoon,
  IconDeviceDesktop,
  IconCheck,
} from "@tabler/icons-react";
import { useAtom } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom.ts";
import { Link, useNavigate } from "react-router-dom";
import APP_ROUTE from "@/lib/app-route.ts";
import useAuth from "@/features/auth/hooks/use-auth.ts";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import { useTranslation } from "react-i18next";
import { AvatarIconType } from "@/features/attachments/types/attachment.types.ts";
import classes from "./sidebar-bottom-nav.module.css";
import { NotificationPopover } from "@/features/notification/components/notification-popover.tsx";
import { useMantineColorScheme } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { SpaceSelect } from "./space-select";
import { getSpaceUrl } from "@/lib/config.ts";

interface SidebarBottomNavProps {
  spaceName?: string;
  spaceSlug?: string;
  spaceLogo?: string;
}

export function SidebarBottomNav({ spaceName, spaceSlug, spaceLogo }: SidebarBottomNavProps) {
  const { t } = useTranslation();
  const [currentUser] = useAtom(currentUserAtom);
  const { logout } = useAuth();
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const navigate = useNavigate();
  const [spaceSelectOpened, { close: closeSpaceSelect, toggle: toggleSpaceSelect }] = useDisclosure(false);

  const user = currentUser?.user;
  const workspace = currentUser?.workspace;

  const handleSpaceSelect = (space: { slug: string }) => {
    if (space?.slug) {
      navigate(getSpaceUrl(space.slug));
      closeSpaceSelect();
    }
  };

  return (
    <div className={classes.bottomNav}>
      <Group justify="flex-start" gap="xs" wrap="nowrap">
        {/* Workspace Switcher */}
        <Popover
          width={300}
          position="top"
          withArrow
          shadow="md"
          opened={spaceSelectOpened}
          onChange={toggleSpaceSelect}
        >
          <Popover.Target>
            <Button
              variant="subtle"
              size="sm"
              fullWidth
              justify="flex-start"
              leftSection={
                <CustomAvatar
                  name={spaceName}
                  avatarUrl={spaceLogo}
                  type={AvatarIconType.SPACE_ICON}
                  color="initials"
                  variant="filled"
                  size={20}
                />
              }
              rightSection={spaceSelectOpened ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
              onClick={toggleSpaceSelect}
              className={classes.workspaceButton}
            >
              <Text size="sm" lineClamp={1} className={classes.workspaceName}>
                {spaceName}
              </Text>
            </Button>
          </Popover.Target>
          <Popover.Dropdown>
            <SpaceSelect
              label={spaceName}
              value={spaceSlug}
              onChange={handleSpaceSelect}
              width={300}
              opened={true}
            />
          </Popover.Dropdown>
        </Popover>

        {/* User Menu */}
        <Menu position="top-start" withArrow shadow="lg" classNames={{ dropdown: classes.menu }}>
          <Menu.Target>
            <Tooltip label={user?.name} withArrow position="top">
              <ActionIcon
                variant="subtle"
                color="violet"
                size="sm"
                className={classes.menuButton}
                aria-label={t("User menu")}
              >
                <CustomAvatar
                  avatarUrl={user?.avatarUrl}
                  name={user?.name}
                  variant="filled"
                  size={20}
                />
              </ActionIcon>
            </Tooltip>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label className={classes.menuLabel}>{t("Workspace")}</Menu.Label>

            <Menu.Item
              component={Link}
              to={APP_ROUTE.SETTINGS.WORKSPACE.GENERAL}
              leftSection={<IconSettings size={16} className={classes.menuItemIcon} />}
              className={classes.menuItem}
            >
              {t("Workspace settings")}
            </Menu.Item>

            <Menu.Item
              component={Link}
              to={APP_ROUTE.SETTINGS.WORKSPACE.MEMBERS}
              leftSection={<IconUsers size={16} className={classes.menuItemIcon} />}
              className={classes.menuItem}
            >
              {t("Manage members")}
            </Menu.Item>

            <Menu.Divider className={classes.menuDivider} />

            <Menu.Label className={classes.menuLabel}>{t("Account")}</Menu.Label>
            <Menu.Item component={Link} to={APP_ROUTE.SETTINGS.ACCOUNT.PROFILE} className={classes.menuItem}>
              <Group wrap={"nowrap"}>
                <CustomAvatar
                  size={"sm"}
                  avatarUrl={user?.avatarUrl}
                  name={user?.name}
                />

                <div className={classes.userInfo}>
                  <span className={classes.userName}>{user?.name}</span>
                  <span className={classes.userEmail}>{user?.email}</span>
                </div>
              </Group>
            </Menu.Item>
            <Menu.Item
              component={Link}
              to={APP_ROUTE.SETTINGS.ACCOUNT.PROFILE}
              leftSection={<IconUserCircle size={16} className={classes.menuItemIcon} />}
              className={classes.menuItem}
            >
              {t("My profile")}
            </Menu.Item>

            <Menu.Item
              component={Link}
              to={APP_ROUTE.SETTINGS.ACCOUNT.PREFERENCES}
              leftSection={<IconBrush size={16} className={classes.menuItemIcon} />}
              className={classes.menuItem}
            >
              {t("My preferences")}
            </Menu.Item>

            <Menu.Sub>
              <Menu.Sub.Target>
                <Menu.Sub.Item leftSection={<IconBrightnessFilled size={16} className={classes.themeIcon} />} className={classes.themeItem}>
                  {t("Theme")}
                </Menu.Sub.Item>
              </Menu.Sub.Target>

              <Menu.Sub.Dropdown>
                <Menu.Item
                  onClick={() => setColorScheme("light")}
                  leftSection={<IconSun size={16} className={classes.themeIcon} />}
                  rightSection={
                    colorScheme === "light" ? <IconCheck size={16} /> : null
                  }
                  className={classes.themeItem}
                >
                  {t("Light")}
                </Menu.Item>
                <Menu.Item
                  onClick={() => setColorScheme("dark")}
                  leftSection={<IconMoon size={16} className={classes.themeIcon} />}
                  rightSection={
                    colorScheme === "dark" ? <IconCheck size={16} /> : null
                  }
                  className={classes.themeItem}
                >
                  {t("Dark")}
                </Menu.Item>
                <Menu.Item
                  onClick={() => setColorScheme("auto")}
                  leftSection={<IconDeviceDesktop size={16} className={classes.themeIcon} />}
                  rightSection={
                    colorScheme === "auto" ? <IconCheck size={16} /> : null
                  }
                  className={classes.themeItem}
                >
                  {t("System settings")}
                </Menu.Item>
              </Menu.Sub.Dropdown>
            </Menu.Sub>

            <Menu.Divider className={classes.menuDivider} />

            <Menu.Item onClick={logout} leftSection={<IconLogout size={16} className={classes.menuItemIcon} />} className={classes.menuItem}>
              {t("Logout")}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>

        {/* Notifications */}
        <NotificationPopover />
      </Group>
    </div>
  );
}
