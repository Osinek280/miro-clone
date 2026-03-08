import { DrawModeEnum } from "../types/types";

export const getCursor = (mode: DrawModeEnum): string => {
  switch (mode) {
    case DrawModeEnum.Draw:
      return `url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABEAAAARCAQAAACRZI9xAAAA1ElEQVR4Xq3NPQ4BURQF4FMgUfjZAi16jdYiKEWYQoRZAEOhkRGS1yhIRJjMLEEjmUb0ViER9SRy5GUiPPN07inPd+8FtMMEi0zruxBkaJ1EYDP3C6RodRyw7AczLWKave0SlCn7gR15Jy/Yq5uoHkJ0Fix8g2HXAfOXEHUcDphQwaC3D7cl2i5pKW8+gcx0zX4EmLs3MFyOmPkrANgYbt6grQGxxzx1VUAW6rBwEi/Q8jiOAIA1w5V18m7utADgpHJser54LGhoAUCTE9ZZYlxbA3gCk6KrqV6OJIIAAAAASUVORK5CYII=") 1 16, crosshair`;
    case DrawModeEnum.Select:
      return "default";
    case DrawModeEnum.Grab:
      return "grabbing";
    default:
      return "default";
  }
};
