import React, { useMemo } from "react";
import { Stack, Loader, Group, Text, Paper } from "@mantine/core";
import { Link } from "react-router-dom";
import { IAiSearchResponse } from "../services/ai-search-service.ts";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import { AiCitationRenderer } from "./AiCitationRenderer.tsx";
import { AiMessageCard } from "./AiMessageCard.tsx";
import { AiInsightsIcon } from "./AiInsightsIcon.tsx";
import { useTranslation } from "react-i18next";
import cardStyles from "./AiMessageCard.module.css";

interface AiSearchResultProps {
  result?: IAiSearchResponse;
  isLoading?: boolean;
  streamingAnswer?: string;
  streamingSources?: any[];
}

export function AiSearchResult({
  result,
  isLoading,
  streamingAnswer = "",
  streamingSources = [],
}: AiSearchResultProps) {
  const { t } = useTranslation();

  // Use streaming data if available, otherwise fall back to result
  const answer = streamingAnswer || result?.answer || "";
  const sources =
    streamingSources.length > 0 ? streamingSources : result?.sources || [];

  // Deduplicate sources by pageId, keeping the one with highest similarity
  const deduplicatedSources = useMemo(() => {
    if (!sources || sources.length === 0) return [];

    const pageMap = new Map();
    sources.forEach((source) => {
      const existing = pageMap.get(source.pageId);
      if (!existing || source.similarity > existing.similarity) {
        pageMap.set(source.pageId, source);
      }
    });

    return Array.from(pageMap.values());
  }, [sources]);

  if (isLoading && !answer) {
    return (
      <Paper p="md" radius="md" withBorder>
        <Group>
          <Loader size="sm" />
          <Text size="sm">{t("AI is thinking...")}</Text>
        </Group>
      </Paper>
    );
  }

  if (!answer && !isLoading) {
    return null;
  }

  return (
    <Stack gap="md" p="md">
      <AiMessageCard
        header={
          <Group gap="xs">
            <AiInsightsIcon />
            {isLoading && <Loader size="xs" />}
          </Group>
        }
      >
        <div className={cardStyles.body}>
          <AiCitationRenderer content={answer} sources={deduplicatedSources} />
        </div>
      </AiMessageCard>

      {deduplicatedSources.length > 0 && (
        <div className={cardStyles.citations}>
          <div className={cardStyles.citationsTitle}>{t("Sources")}</div>
          {deduplicatedSources.map((source, index) => (
            <Link
              key={source.pageId}
              to={buildPageUrl(source.spaceSlug, source.slugId, source.title)}
              className={cardStyles.citationLink}
            >
              <div
                className={cardStyles.citationRow}
                style={{ animationDelay: `${index * 0.07}s` }}
              >
                <div className={cardStyles.citationNum}>{index + 1}</div>
                <div className={cardStyles.citationContent}>
                  <div className={cardStyles.citationSource}>
                    <span className={cardStyles.citationSourceText}>
                      {source.title}
                    </span>
                  </div>
                  {source.excerpt && (
                    <div className={cardStyles.citationSnippet}>
                      {source.excerpt}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Stack>
  );
}
