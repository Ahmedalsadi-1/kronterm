#!/bin/bash
set -e

DATA_DIR="$HOME/.waveterm/sandbox"
mkdir -p "$DATA_DIR"
cd "$DATA_DIR"

ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
    QEMU_BIN="qemu-system-aarch64"
    IMG_URL="https://cloud-images.ubuntu.com/noble/current/noble-server-cloudimg-arm64.img"
else
    QEMU_BIN="qemu-system-x86_64"
    IMG_URL="https://cloud-images.ubuntu.com/noble/current/noble-server-cloudimg-amd64.img"
fi

echo "Setting up Wave Sandbox for $ARCH in $DATA_DIR..."
echo "Using QEMU: $QEMU_BIN"

if ! command -v "$QEMU_BIN" &> /dev/null; then
    echo "Error: $QEMU_BIN not found. Install with: brew install qemu"
    exit 1
fi

IMG_FILE="ubuntu-desktop.qcow2"

if [ ! -f "$IMG_FILE" ]; then
    echo "Downloading Ubuntu Cloud Image..."
    curl -L -o "$IMG_FILE" "$IMG_URL"
    echo "Resizing image to 20G..."
    qemu-img resize "$IMG_FILE" 20G
else
    echo "Image already exists."
fi

echo "Generating cloud-init configuration..."
mkdir -p cidata
cd cidata

cat > meta-data <<'EOF'
instance-id: wave-sandbox-01
local-hostname: wave-sandbox
EOF

PASSWD_HASH=$(openssl passwd -1 -salt wave wave123)

cat > user-data <<EOF
#cloud-config
users:
  - name: ubuntu
    ssh_authorized_keys: []
    sudo: ALL=(ALL) NOPASSWD:ALL
    groups: sudo
    shell: /bin/bash
    lock_passwd: false
    passwd: $PASSWD_HASH

package_update: true
packages:
  - xfce4
  - xfce4-goodies
  - tightvncserver
  - xdotool
  - scrot
  - net-tools
  - xterm
  - openssh-server

write_files:
  - path: /home/ubuntu/.vnc/xstartup
    permissions: '0755'
    owner: ubuntu:ubuntu
    content: |
      #!/bin/bash
      xrdb $HOME/.Xresources
      startxfce4 &

runcmd:
  - echo 'ubuntu:wave123' | chpasswd
  - su - ubuntu -c "mkdir -p ~/.vnc && echo 'wave123' | vncpasswd -f > ~/.vnc/passwd && chmod 600 ~/.vnc/passwd"
  - su - ubuntu -c "vncserver :1 -geometry 1280x800 -depth 24"
  - sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config
  - sed -i 's/PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config
  - systemctl enable ssh
  - systemctl restart ssh
EOF

cd ..

echo "Creating seed.iso..."
if [ -f "seed.iso" ]; then
    rm "seed.iso"
fi

hdiutil makehybrid -o seed.iso -hfs -joliet -iso -default-volume-name cidata cidata/

rm -rf cidata

echo ""
echo "============================================"
echo "Setup Complete!"
echo ""
echo "Data directory: $DATA_DIR"
echo "Disk image: $DATA_DIR/$IMG_FILE"
echo "Cloud-init: $DATA_DIR/seed.iso"
echo ""
echo "VNC port: 5901"
echo "SSH port: 2222"
echo "VNC Password: wave123"
echo "SSH Password: wave123"
echo "============================================"
