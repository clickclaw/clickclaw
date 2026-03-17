export interface BackupActionsBarProps {
  creating: boolean
  archiving: boolean
  onCreateSnapshot: () => Promise<void>
  onCreateFull: () => Promise<void>
}

export interface SnapshotHistoryTableProps {
  snapshots: SnapshotListItem[]
  loading: boolean
  onRestore: (fileName: string) => void
}
