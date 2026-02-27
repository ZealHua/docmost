import { Group, Text, Textarea, Title } from "@mantine/core";
import { useAtom } from "jotai";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { updateWorkspace } from "@/features/workspace/services/workspace-service.ts";
import { notifications } from "@mantine/notifications";

export default function UserProfileInput() {
  const { t } = useTranslation();
  const [workspace] = useAtom(workspaceAtom);
  const [value, setValue] = useState(
    workspace?.settings?.ai?.userProfile || "",
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(workspace?.settings?.ai?.userProfile || "");
  }, [workspace?.settings?.ai?.userProfile]);

  const handleBlur = async () => {
    if (value === (workspace?.settings?.ai?.userProfile || "")) {
      return;
    }

    setSaving(true);
    try {
      const updatedWorkspace = await updateWorkspace({ userProfile: value });
      notifications.show({
        message: t("User profile saved"),
        color: "green",
      });
    } catch (err) {
      notifications.show({
        message:
          err?.response?.data?.message || t("Failed to save user profile"),
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Title order={5} mb="xs">
        {t("User Profile")}
      </Title>
      <Text size="sm" c="dimmed" mb="md">
        {t(
          "Provide context about the user (name, role, preferences) to personalize AI responses. This will be injected into the system prompt for the Intelligence feature.",
        )}
      </Text>
      <Textarea
        placeholder={t(
          "e.g., John is a software engineer who prefers technical explanations...",
        )}
        minRows={3}
        maxRows={6}
        value={value}
        onChange={(event) => setValue(event.currentTarget.value)}
        onBlur={handleBlur}
        disabled={saving}
      />
    </>
  );
}
