import { MEDIA_SHINE_SHADER_FS } from "../constants";
import ShaderSurface from "./ShaderSurface";

type MediaShineFxProps = {
  active?: boolean;
};

function MediaShineFx({ active = true }: MediaShineFxProps) {
  if (!active) {
    return null;
  }

  return (
    <ShaderSurface
      fs={MEDIA_SHINE_SHADER_FS}
      className="media-shine-layer"
      onStatusChange={(status) => {
        if (status.validationError) {
          console.warn("Media shine shader validation failed:", status.validationError);
        }
        if (status.runtimeError) {
          console.warn("Media shine shader disabled:", status.runtimeError);
        }
      }}
    />
  );
}

export default MediaShineFx;
