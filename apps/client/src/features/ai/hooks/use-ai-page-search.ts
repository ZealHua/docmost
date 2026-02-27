import { useMutation } from "@tanstack/react-query";
import api from "@/lib/api-client";

export interface AiPageSearchResult {
  pageId: string;
  title: string;
  slugId: string;
  spaceId: string;
  spaceSlug: string;
}

interface PageSearchParams {
  query?: string;
  spaceId: string;
  pageIds?: string[];
}

export function useAiPageSearch() {
  return useMutation({
    mutationFn: async (
      params: PageSearchParams,
    ): Promise<AiPageSearchResult[]> => {
      const response = await api.post<AiPageSearchResult[]>(
        "/ai/pages/search",
        params,
      );
      return response.data;
    },
  });
}
