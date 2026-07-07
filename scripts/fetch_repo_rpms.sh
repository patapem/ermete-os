#!/bin/bash
set -e

mkdir -p /github/home/repo
export STORAGE_DRIVER=vfs
export BUILDAH_ISOLATION=chroot

OWNER="${1}"

IMAGES=(
  "ermete-forge-kernel"
  "ermete-forge-nvidia"
  "ermete-forge-initramfs"
)

# Custom Packages
for pkg in starship bat selinux ananicy base-config ags-config niri-session ide-bootstrap system-services nix-support system-config system-tweaks matugen bibata; do
  IMAGES+=("ermete-forge-$pkg")
done

# CachyOS Addons
for pkg in bore-sysctl scx-scheds scx-tools; do
  IMAGES+=("ermete-forge-$pkg")
done

# AGS Ecosystem
for pkg in appmenu-glib-translator astal-io astal astal-libs astal-gjs astal-gtk4 astal-lua aylurs-gtk-shell2 hyprpanel; do
  IMAGES+=("ermete-forge-$pkg")
done

# Upstream Packages
UPSTREAM=(
  brightnessctl btrfs-progs dbus-tools dbus-x11 distribution-gpg-keys drm_info file-roller firewalld fuse fwupd gnome-keyring gnome-keyring-pam greenboot greenboot-default-health-checks gvfs libnotify libxcrypt-compat lm_sensors mokutil nftables openssl qemu-kvm sbsigntools squashfuse sysstat upower virt-manager
  niri adw-gtk3-theme fontawesome-fonts-all foot greetd gtk4-layer-shell gtk-layer-shell jetbrains-mono-fonts papirus-icon-theme qt5-qtwayland qt6-qtwayland rsms-inter-fonts swaybg swaylock thunar thunar-archive-plugin thunar-volman tuigreet wayland-utils xdg-desktop-portal-gnome xdg-desktop-portal-gtk xdg-user-dirs xdg-user-dirs-gtk xorg-x11-server-Xwayland
  pipewire nodejs npm ffmpeg mpv wireplumber x264 libva-nvidia-driver libva-utils imv mesa-dri-drivers mesa-vulkan-drivers
  btop eza fd-find git inotify-tools just nushell parallel playerctl ripgrep rsync sqlite unzip wl-clipboard wl-mirror wlr-randr
)

for pkg in "${UPSTREAM[@]}"; do
  IMAGES+=("ermete-forge-rolling-$pkg")
done

echo "Pulling RPMs from ${#IMAGES[@]} containers..."

for img in "${IMAGES[@]}"; do
  IMAGE_LOWER=$(echo "ghcr.io/$OWNER/$img:latest" | tr '[:upper:]' '[:lower:]')
  echo ">>> Pulling $IMAGE_LOWER"
  
  # Best effort: if a container is missing (e.g. failed to build), we just skip it
  ctr=$(buildah from "$IMAGE_LOWER" || true)
  if [ -n "$ctr" ]; then
    mnt=$(buildah mount $ctr)
    # Copia gli rpm
    cp -a $mnt/*.rpm /github/home/repo/ 2>/dev/null || true
    buildah umount $ctr
    buildah rm $ctr
  else
    echo "    [!] Immagine non trovata o scaricamento fallito per $img"
  fi
done

echo "--- Extracted RPMs ---"
ls -lh /github/home/repo/
