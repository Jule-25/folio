import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-location";
import {
  useAcceptInvite,
  useDeclineInvite,
  useMyInvites,
} from "src/hooks/use-teamspace-members";
import { useToast } from "src/features/shell/toast";
import { Button } from "src/components/tiptap-ui-primitive/button";
import { PageItemIcon } from "src/features/pages/page-item/page-item-icon";
import type { PageCover, TeamspaceInvite } from "src/types";

// The invite snapshot carries the teamspace's icon; shaped as a PageCover so
// it renders like the teamspace row will once joined (as in TeamspacesPanel).
function inviteCover(inv: TeamspaceInvite): PageCover {
  return {
    iconName: inv.iconName,
    target: (inv.iconTarget as PageCover["target"]) ?? null,
    coverImage: null,
    color: null,
    gradient: null,
    positionY: null,
  };
}

// Invitations to teamspaces, at the top of the inbox under the workspace
// ones. No email is sent for an invite, so this is where people find it.
// Accepting joins the teamspace and enters it.
export function TeamspaceInvites({ onDone }: { onDone?: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { show } = useToast();
  const { invites } = useMyInvites();
  const accept = useAcceptInvite();
  const decline = useDeclineInvite();

  if (invites.length === 0) return null;

  const busy = accept.isPending || decline.isPending;

  return (
    <div className="inbox-invites">
      {invites.map((inv) => {
        const name = inv.teamspaceName || t("inbox.teamspaceInvite.aTeamspace");
        return (
          <div key={inv.id} className="inbox-invite">
            <span className="inbox-item__icon">
              <PageItemIcon
                cover={inviteCover(inv)}
                styles={{ width: 15, height: 15, fontSize: 14 }}
              />
            </span>
            <span className="inbox-item__text">
              <span className="inbox-item__title">
                {t("inbox.teamspaceInvite.title", { teamspace: name })}
              </span>
              <span className="inbox-item__message">
                {t("inbox.teamspaceInvite.from", {
                  name: inv.inviterName ?? t("inbox.invite.someone"),
                })}
              </span>
              <span className="inbox-invite__actions">
                <Button
                  disabled={busy}
                  onClick={() =>
                    accept.mutate(inv.id, {
                      onSuccess: (teamspaceId) => {
                        navigate({ to: `/t/${teamspaceId}` });
                        show(
                          t("inbox.teamspaceInvite.joined", {
                            teamspace: name,
                          }),
                          "success",
                        );
                        onDone?.();
                      },
                      onError: (e) =>
                        show(
                          e instanceof Error
                            ? e.message
                            : t("inbox.invite.failed"),
                          "error",
                        ),
                    })
                  }
                >
                  <span className="tiptap-button-text">
                    {t("inbox.invite.accept")}
                  </span>
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => decline.mutate(inv.id)}
                >
                  <span className="tiptap-button-text">
                    {t("inbox.invite.decline")}
                  </span>
                </Button>
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
