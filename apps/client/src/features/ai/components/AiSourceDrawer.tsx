import React from "react";
import { Drawer, Text, Anchor, ScrollArea } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { useAtom, useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import {
  aiSourceSidebarOpenAtom,
  aiActiveSourceMessageIdAtom,
  aiMessagesAtom,
} from "../store/ai.atoms";
import { buildPageUrl } from "@/features/page/page.utils";
import { Link } from "react-router-dom";
import styles from "./AiSourceDrawer.module.css";

const getFavicon = (url: string) => {
  try {
    const hostname = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
  } catch {
    return "/default-favicon.ico";
  }
};

const getHostname = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

export function AiSourceDrawer() {
  const { t } = useTranslation();
  const [opened, setOpened] = useAtom(aiSourceSidebarOpenAtom);
  const activeMessageId = useAtomValue(aiActiveSourceMessageIdAtom);
  const messages = useAtomValue(aiMessagesAtom);

  const activeMessage = messages.find((m) => m.id === activeMessageId);
  const sources = activeMessage?.sources || [];

  return (
    <Drawer
      opened={opened}
      onClose={() => setOpened(false)}
      position="right"
      size="clamp(320px, 38vw, 520px)"
      title={
        <div className={styles.drawerHeader}>
          <IconSearch size={18} className={styles.headerIcon} />
          <Text fw={600} size="md">
            {t("Sources")}
          </Text>
          <span className={styles.badge}>{sources.length}</span>
        </div>
      }
      padding="md"
      overlayProps={{ opacity: 0.3, blur: 2 }}
      styles={{
        header: {
          borderBottom: "1px solid var(--ai-card-border)",
          paddingBottom: "12px",
          backgroundColor: "var(--mantine-color-body)",
        },
        body: { padding: "16px 0 0 0" },
      }}
      scrollAreaComponent={ScrollArea.Autosize}
      aria-label={t("Sources list")}
    >
      <div className={styles.sourcesList}>
        {sources.map((source, index) => {
          const isWeb = !!source.url;

          return (
            <div
              key={`${source.pageId || source.url}-${index}`}
              className={styles.sourceCardWrapper}
            >
              {/* Target the link directly around the card to make the whole thing clickable if desired,
                  or keep it internal as per standard design. Here we make the card outline a link context. */}
              <article className={styles.sourceCard}>
                <div className={styles.cardHeader}>
                  {isWeb ? (
                    <>
                      <img
                        src={getFavicon(source.url!)}
                        alt=""
                        className={styles.favicon}
                      />
                      <Text size="xs" fw={500} c="dimmed" truncate>
                        {getHostname(source.url!)}
                      </Text>
                    </>
                  ) : (
                    <>
                      <div className={styles.internalIcon} />
                      <Text size="xs" fw={500} c="dimmed" truncate>
                        {source.spaceSlug || "Internal"}
                      </Text>
                    </>
                  )}
                </div>

                <Text className={styles.cardTitle} lineClamp={2} dir="auto">
                  {isWeb ? (
                    <Anchor
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      c="blue.6"
                    >
                      {source.title}
                    </Anchor>
                  ) : (
                    <Anchor
                      component={Link}
                      to={buildPageUrl(
                        source.spaceSlug,
                        source.slugId,
                        source.title,
                      )}
                      c="blue.6"
                    >
                      {source.title}
                    </Anchor>
                  )}
                </Text>

                {source.excerpt && (
                  <Text className={styles.cardExcerpt} dir="auto">
                    {source.excerpt}
                  </Text>
                )}
              </article>
            </div>
          );
        })}
      </div>
    </Drawer>
  );
}
