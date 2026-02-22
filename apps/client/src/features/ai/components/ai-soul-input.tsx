import { Group, Text, Textarea, Title } from "@mantine/core";
import { useAtom } from "jotai";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { updateWorkspace } from "@/features/workspace/services/workspace-service.ts";
import { notifications } from "@mantine/notifications";

export default function AiSoulInput() {
  const { t } = useTranslation();
  const [workspace] = useAtom(workspaceAtom);
  const [value, setValue] = useState(workspace?.settings?.ai?.aiSoul || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(workspace?.settings?.ai?.aiSoul || "");
  }, [workspace?.settings?.ai?.aiSoul]);

  const handleBlur = async () => {
    if (value === (workspace?.settings?.ai?.aiSoul || "")) {
      return;
    }

    setSaving(true);
    try {
      const updatedWorkspace = await updateWorkspace({ aiSoul: value });
      notifications.show({
        message: t("AI soul saved"),
        color: "green",
      });
    } catch (err) {
      notifications.show({
        message: err?.response?.data?.message || t("Failed to save AI soul"),
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Title order={5} mb="xs">{t("AI Soul")}</Title>
      <Text size="sm" c="dimmed" mb="md">
        {t("Define the AI's personality, tone, and communication style. This will be injected into the system prompt for the Intelligence feature.")}
      </Text>
      <Textarea
        placeholder={t("e.g., You are a helpful, friendly assistant who explains things in simple terms...")}
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
