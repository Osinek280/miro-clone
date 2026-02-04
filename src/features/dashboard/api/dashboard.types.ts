export type Whiteboard = {
  id: string;
  name: string;
  role: "OWNER" | "EDITOR" | "VIEWER";
  cameraPosition: {
    x: number;
    y: number;
    zoom: number;
  };
  lastOpenedAt: string;
};

export type CloseWhiteboardRequest = {
  x: number;
  y: number;
  zoom: number;
};
