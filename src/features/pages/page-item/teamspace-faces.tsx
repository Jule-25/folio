import { useTranslation } from "react-i18next";
import { useTeamspaceMemberList } from "src/hooks/use-teamspace-members";

// The first members of a teamspace, as small overlapping faces on the right
// of its sidebar row (owners first, as the members panel lists them). Past
// three, the last slot shows "+N".
const MAX_FACES = 3;

// A steady colour per person for faces without a photo.
const FACE_COLORS = ["#8a6fd1", "#e08a4a", "#4f9a7a", "#d65b7a", "#4a86d6"];
function faceColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return FACE_COLORS[Math.abs(h) % FACE_COLORS.length];
}

export function TeamspaceFaces({ teamspaceId }: { teamspaceId: string }) {
  const { t } = useTranslation();
  const { members } = useTeamspaceMemberList(teamspaceId);
  if (members.length === 0) return null;

  const overflow = members.length > MAX_FACES;
  const shown = members.slice(0, overflow ? MAX_FACES - 1 : MAX_FACES);
  const label = t("teamspaces.memberCount", { count: members.length });

  return (
    <span
      className="page-item-faces"
      role="img"
      aria-label={label}
      title={label}
    >
      {shown.map(({ person }) =>
        person.avatarUrl ? (
          <img
            key={person.id}
            className="page-item-face"
            src={person.avatarUrl}
            alt=""
          />
        ) : (
          <span
            key={person.id}
            className="page-item-face"
            style={{ background: faceColor(person.id) }}
          >
            {(person.name || "?").trim().charAt(0).toUpperCase()}
          </span>
        ),
      )}
      {overflow && (
        <span className="page-item-face page-item-face--more">
          +{members.length - (MAX_FACES - 1)}
        </span>
      )}
    </span>
  );
}
