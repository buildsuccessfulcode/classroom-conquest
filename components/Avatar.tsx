"use client";

import { memo } from "react";
import { isAvatarId } from "@/lib/avatars";

function Face({ id }: { id: string }) {
  if (id === "anjing") {
    return (
      <>
        <rect width="48" height="48" rx="14" fill="#EFEBE9" />
        <ellipse cx="12" cy="26" rx="6" ry="11" fill="#8D6E63" />
        <ellipse cx="36" cy="26" rx="6" ry="11" fill="#8D6E63" />
        <circle cx="24" cy="25" r="13" fill="#D7CCC8" />
        <circle cx="19" cy="23" r="1.8" fill="#3E2723" />
        <circle cx="29" cy="23" r="1.8" fill="#3E2723" />
        <ellipse cx="24" cy="30" rx="4" ry="3" fill="#3E2723" />
        <path d="M24 33v3" stroke="#3E2723" strokeWidth="1.6" strokeLinecap="round" />
      </>
    );
  }
  if (id === "rubah") {
    return (
      <>
        <rect width="48" height="48" rx="14" fill="#FFF3E0" />
        <path d="M11 19 15 6l8 8Z" fill="#EA580C" />
        <path d="M37 19 33 6l-8 8Z" fill="#EA580C" />
        <path d="M11 20 15 9l6 7Z" fill="#FDBA74" />
        <path d="M37 20 33 9l-6 7Z" fill="#FDBA74" />
        <circle cx="24" cy="26" r="13" fill="#FB923C" />
        <path d="M17 30c3 4 11 4 14 0-2 6-12 6-14 0Z" fill="#FFF7ED" />
        <circle cx="19" cy="24" r="1.8" fill="#3E2723" />
        <circle cx="29" cy="24" r="1.8" fill="#3E2723" />
        <circle cx="24" cy="30" r="2" fill="#3E2723" />
      </>
    );
  }
  if (id === "panda") {
    return (
      <>
        <rect width="48" height="48" rx="14" fill="#F5F5F5" />
        <circle cx="13" cy="13" r="6" fill="#212121" />
        <circle cx="35" cy="13" r="6" fill="#212121" />
        <circle cx="24" cy="26" r="14" fill="#FFFFFF" />
        <ellipse cx="18" cy="24" rx="4" ry="5" fill="#212121" />
        <ellipse cx="30" cy="24" rx="4" ry="5" fill="#212121" />
        <circle cx="18" cy="24" r="1.6" fill="#FFFFFF" />
        <circle cx="30" cy="24" r="1.6" fill="#FFFFFF" />
        <ellipse cx="24" cy="31" rx="3" ry="2.2" fill="#212121" />
      </>
    );
  }
  if (id === "kelinci") {
    return (
      <>
        <rect width="48" height="48" rx="14" fill="#FCE4EC" />
        <ellipse cx="17" cy="12" rx="4.5" ry="10" fill="#F9A8D4" />
        <ellipse cx="31" cy="12" rx="4.5" ry="10" fill="#F9A8D4" />
        <circle cx="24" cy="28" r="13" fill="#FDF2F8" />
        <circle cx="19" cy="26" r="1.8" fill="#831843" />
        <circle cx="29" cy="26" r="1.8" fill="#831843" />
        <path d="M22 31h4l-2 2Z" fill="#BE185D" />
        <path d="M24 33v2" stroke="#BE185D" strokeWidth="1.4" strokeLinecap="round" />
      </>
    );
  }
  if (id === "katak") {
    return (
      <>
        <rect width="48" height="48" rx="14" fill="#E8F5E9" />
        <circle cx="15" cy="16" r="7" fill="#4ADE80" />
        <circle cx="33" cy="16" r="7" fill="#4ADE80" />
        <circle cx="15" cy="16" r="4" fill="#FFFFFF" />
        <circle cx="33" cy="16" r="4" fill="#FFFFFF" />
        <circle cx="15" cy="16" r="2" fill="#14532D" />
        <circle cx="33" cy="16" r="2" fill="#14532D" />
        <circle cx="24" cy="29" r="12" fill="#4ADE80" />
        <path d="M17 31c4 5 10 5 14 0" stroke="#14532D" strokeWidth="2" fill="none" strokeLinecap="round" />
      </>
    );
  }
  if (id === "pinguin") {
    return (
      <>
        <rect width="48" height="48" rx="14" fill="#E3F2FD" />
        <ellipse cx="24" cy="26" rx="14" ry="15" fill="#1E3A8A" />
        <ellipse cx="24" cy="30" rx="9" ry="11" fill="#FFFFFF" />
        <circle cx="19" cy="23" r="2" fill="#FFFFFF" />
        <circle cx="29" cy="23" r="2" fill="#FFFFFF" />
        <circle cx="19" cy="23" r="1" fill="#0F172A" />
        <circle cx="29" cy="23" r="1" fill="#0F172A" />
        <path d="M20 28h8l-4 4Z" fill="#FB923C" />
      </>
    );
  }
  if (id === "koala") {
    return (
      <>
        <rect width="48" height="48" rx="14" fill="#ECEFF1" />
        <circle cx="12" cy="18" r="8" fill="#B0BEC5" />
        <circle cx="36" cy="18" r="8" fill="#B0BEC5" />
        <circle cx="12" cy="18" r="4" fill="#CFD8DC" />
        <circle cx="36" cy="18" r="4" fill="#CFD8DC" />
        <circle cx="24" cy="27" r="14" fill="#CFD8DC" />
        <circle cx="19" cy="25" r="1.8" fill="#37474F" />
        <circle cx="29" cy="25" r="1.8" fill="#37474F" />
        <ellipse cx="24" cy="31" rx="4.5" ry="4" fill="#455A64" />
      </>
    );
  }
  return (
    <>
      <rect width="48" height="48" rx="14" fill="#FFF3E0" />
      <path d="M11 19 15 6l8 8Z" fill="#F59E0B" />
      <path d="M37 19 33 6l-8 8Z" fill="#F59E0B" />
      <circle cx="24" cy="26" r="13" fill="#FDBA74" />
      <circle cx="19" cy="24" r="1.8" fill="#7C2D12" />
      <circle cx="29" cy="24" r="1.8" fill="#7C2D12" />
      <path d="M22 30h4l-2 2Z" fill="#7C2D12" />
      <path d="M10 28h6M10 32h6M38 28h-6M38 32h-6" stroke="#7C2D12" strokeWidth="1.3" strokeLinecap="round" />
    </>
  );
}

function Avatar({
  id,
  size = 40,
  ringColor,
  className = "",
  title,
}: {
  id: string | null | undefined;
  size?: number;
  ringColor?: string;
  className?: string;
  title?: string;
}) {
  const avatarId = isAvatarId(id) ? id : "kucing";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ${
        ringColor ? "border-2" : ""
      } ${className}`}
      style={{
        width: size,
        height: size,
        borderColor: ringColor,
      }}
      title={title}
    >
      <svg viewBox="0 0 48 48" className="h-full w-full">
        <Face id={avatarId} />
      </svg>
    </span>
  );
}

export default memo(Avatar);
