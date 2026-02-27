import { ActionIcon, Tooltip, Badge } from "@mantine/core";
import { IconFiles } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

import { useArtifacts } from "../../context/artifacts-context";

export function ArtifactHeaderButton() {
  const { t } = useTranslation();
  const { artifacts, open, setOpen } = useArtifacts();

  const shouldShow = artifacts.length > 0 && !open;

  if (!shouldShow) {
    return null;
  }

  return (
    <Tooltip label={t("Artifacts")}>
      <ActionIcon
        variant="subtle"
        size="lg"
        onClick={() => setOpen(true)}
        className="artifact-header-button"
      >
        <IconFiles size={20} />
        {artifacts.length > 0 && (
          <Badge size="xs" circle className="artifact-badge">
            {artifacts.length}
          </Badge>
        )}
      </ActionIcon>
    </Tooltip>
  );
}
