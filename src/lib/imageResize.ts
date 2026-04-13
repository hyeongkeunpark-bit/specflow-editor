/**
 * 이미지 리사이즈 유틸리티
 * - 최대 1568px (Claude Vision 권장 최대)
 * - JPEG quality 0.85
 * - base64 data URL 반환
 */

const MAX_SIZE = 1568;
const JPEG_QUALITY = 0.85;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export interface ResizedImage {
  base64: string; // data:image/jpeg;base64,... 형식
  mediaType: "image/jpeg";
  width: number;
  height: number;
}

/** 파일이 이미지인지 확인 */
export function isImageFile(file: File): boolean {
  return /^image\/(png|jpe?g|gif|webp)$/.test(file.type);
}

/** 파일 크기 검증 */
export function validateFileSize(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return `파일 크기가 ${Math.round(file.size / 1024 / 1024)}MB입니다. 최대 10MB까지 지원합니다.`;
  }
  return null;
}

/** 이미지를 최대 1568px로 리사이즈하여 base64 반환 */
export function resizeImage(file: File): Promise<ResizedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // 최대 크기 초과 시 비율 유지 리사이즈
      if (width > MAX_SIZE || height > MAX_SIZE) {
        if (width > height) {
          height = Math.round(height * (MAX_SIZE / width));
          width = MAX_SIZE;
        } else {
          width = Math.round(width * (MAX_SIZE / height));
          height = MAX_SIZE;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context 생성 실패"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);

      resolve({
        base64: dataUrl,
        mediaType: "image/jpeg",
        width,
        height,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지 로드 실패"));
    };

    img.src = url;
  });
}

/** data URL에서 base64 부분만 추출 (data:image/jpeg;base64, 제거) */
export function extractBase64(dataUrl: string): string {
  const idx = dataUrl.indexOf(",");
  return idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
}
