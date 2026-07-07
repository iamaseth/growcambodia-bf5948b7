import { Facebook, MessageCircle, Send, Link as LinkIcon, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export function ShareMenu({ url, text, trigger }: { url: string; text: string; trigger: React.ReactNode }) {
  const enc = (s: string) => encodeURIComponent(s);
  const items: { label: string; icon: React.ReactNode; href?: string; onClick?: () => void }[] = [
    { label: "WhatsApp", icon: <MessageCircle className="h-4 w-4" />, href: `https://wa.me/?text=${enc(text + " " + url)}` },
    { label: "Facebook", icon: <Facebook className="h-4 w-4" />, href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
    { label: "Messenger", icon: <MessageCircle className="h-4 w-4" />, href: `https://www.facebook.com/dialog/send?link=${enc(url)}&app_id=140586622674265&redirect_uri=${enc(url)}` },
    { label: "Telegram", icon: <Send className="h-4 w-4" />, href: `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}` },
    { label: "X (Twitter)", icon: <Send className="h-4 w-4" />, href: `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}` },
    { label: "LinkedIn", icon: <Send className="h-4 w-4" />, href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}` },
    { label: "Email", icon: <Mail className="h-4 w-4" />, href: `mailto:?subject=${enc(text)}&body=${enc(url)}` },
    {
      label: "Copy link",
      icon: <LinkIcon className="h-4 w-4" />,
      onClick: async () => {
        try {
          await navigator.clipboard.writeText(url);
          toast.success("Link copied");
        } catch {
          toast.error("Couldn't copy");
        }
      },
    },
  ];

  const tryNative = async () => {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({ title: text, text, url });
        return true;
      } catch {
        /* user cancel or unsupported */
      }
    }
    return false;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={async (e) => {
        if (await tryNative()) e.preventDefault();
      }}>
        <Button variant="ghost" size="sm">{trigger}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {items.map((it) => (
          <DropdownMenuItem
            key={it.label}
            onClick={() => (it.onClick ? it.onClick() : window.open(it.href, "_blank", "noopener,noreferrer"))}
            className="gap-2 cursor-pointer"
          >
            {it.icon} {it.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
