import { createContext, useContext, useState, useMemo, ReactNode } from "react";

export interface ArtifactsContextType {
  artifacts: string[];
  setArtifacts: (artifacts: string[]) => void;

  selectedArtifact: string | null;
  autoSelect: boolean;
  select: (artifact: string, autoSelect?: boolean) => void;
  deselect: () => void;

  open: boolean;
  autoOpen: boolean;
  setOpen: (open: boolean) => void;
  setAutoOpen: (autoOpen: boolean) => void;

  artifactPanelOpen: boolean;
}

const ArtifactsContext = createContext<ArtifactsContextType | undefined>(
  undefined,
);

interface ArtifactsProviderProps {
  children: ReactNode;
}

export function ArtifactsProvider({ children }: ArtifactsProviderProps) {
  const [artifacts, setArtifacts] = useState<string[]>([]);
  const [selectedArtifact, setSelectedArtifact] = useState<string | null>(null);
  const [autoSelect, setAutoSelect] = useState(true);
  const [open, setOpen] = useState(true);
  const [autoOpen, setAutoOpen] = useState(true);

  const artifactPanelOpen = useMemo(() => {
    return open && artifacts.length > 0;
  }, [open, artifacts]);

  const select = (artifact: string, autoSelectFlag = false) => {
    setSelectedArtifact(artifact);
    if (!autoSelectFlag) {
      setAutoSelect(false);
    }
  };

  const deselect = () => {
    setSelectedArtifact(null);
    setAutoSelect(true);
  };

  const handleSetOpen = (isOpen: boolean) => {
    if (!isOpen && autoOpen) {
      setAutoOpen(false);
      setAutoSelect(false);
    }
    setOpen(isOpen);
  };

  const value: ArtifactsContextType = {
    artifacts,
    setArtifacts,

    open,
    autoOpen,
    autoSelect,
    setOpen: handleSetOpen,
    setAutoOpen,

    selectedArtifact,
    select,
    deselect,

    artifactPanelOpen,
  };

  return (
    <ArtifactsContext.Provider value={value}>
      {children}
    </ArtifactsContext.Provider>
  );
}

export function useArtifacts() {
  const context = useContext(ArtifactsContext);
  if (context === undefined) {
    throw new Error("useArtifacts must be used within an ArtifactsProvider");
  }
  return context;
}
