import { Crown, Edit, Eye } from "lucide-react";
import type { Whiteboard } from "../api/dashboard.types";

export const getGradient = (id: string) => {
  const gradients = [
    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
    "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
    "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
  ];

  const index =
    id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) %
    gradients.length;

  return gradients[index];
};

export const getRoleIcon = (role: Whiteboard["role"]) => {
  switch (role) {
    case "OWNER":
      return <Crown className="h-3.5 w-3.5" />;
    case "EDITOR":
      return <Edit className="h-3.5 w-3.5" />;
    case "VIEWER":
      return <Eye className="h-3.5 w-3.5" />;
  }
};

export const getRoleLabel = (role: Whiteboard["role"]) => {
  switch (role) {
    case "OWNER":
      return "Właściciel";
    case "EDITOR":
      return "Edytor";
    case "VIEWER":
      return "Obserwator";
  }
};

export const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const today = new Date();

  const diffTime = Math.abs(today.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Dzisiaj";
  if (diffDays === 1) return "Wczoraj";
  if (diffDays < 7) return `${diffDays} dni temu`;

  return date.toLocaleDateString("pl-PL");
};
