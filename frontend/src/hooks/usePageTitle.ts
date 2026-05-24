import { useEffect } from "react";

const BASE = "I Love Great Epic Mahabharat";

export const usePageTitle = (page?: string) => {
  useEffect(() => {
    document.title = page ? `${page} — ${BASE}` : BASE;
    return () => {
      document.title = BASE;
    };
  }, [page]);
};
