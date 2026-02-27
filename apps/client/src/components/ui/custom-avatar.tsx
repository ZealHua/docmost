import React from "react";
import { Avatar } from "@mantine/core";
import { getAvatarUrl } from "@/lib/config.ts";
import { AvatarIconType } from "@/features/attachments/types/attachment.types.ts";
import classes from "./custom-avatar.module.css";

interface CustomAvatarProps {
  avatarUrl: string;
  name: string;
  color?: string;
  size?: string | number;
  radius?: string | number;
  variant?: string;
  style?: any;
  component?: any;
  type?: AvatarIconType;
  mt?: string | number;
  showOrbitalRing?: boolean;
}

export const CustomAvatar = React.forwardRef<
  HTMLInputElement,
  CustomAvatarProps
>(
  (
    {
      avatarUrl,
      name,
      type,
      showOrbitalRing = true,
      ...props
    }: CustomAvatarProps,
    ref,
  ) => {
    const avatarLink = getAvatarUrl(avatarUrl, type);

    return (
      <div
        className={`${classes.avatarWrapper} ${showOrbitalRing ? classes.hasRing : ""}`}
      >
        {showOrbitalRing && <div className={classes.avatarRing} />}
        <Avatar
          ref={ref}
          src={avatarLink}
          name={name}
          alt={name}
          color="initials"
          {...props}
        />
      </div>
    );
  },
);
