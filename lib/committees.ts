export type DirectoryCommittee = {
  id: string; name: string; description: string; responsibilities: string[];
  board_membership: boolean; show_public: boolean;
  members: { id: string; name: string; role: string; show_public: boolean }[];
};
