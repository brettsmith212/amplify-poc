export type TabType = 'thread' | 'terminal' | 'gitdiff';

export interface Tab {
  id: TabType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
}

export interface TabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  className?: string;
}
