#!/usr/bin/env python3
"""
motion_track.py — Real-time webcam motion tracking with OpenCV.

Usage:
    python3 motion_track.py                  # live view only
    python3 motion_track.py --record out.mp4 # record to file
    python3 motion_track.py --min-area 1000  # larger minimum motion
"""

import argparse
import time
import cv2
import numpy as np


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Webcam motion tracking")
    parser.add_argument(
        "--record",
        metavar="FILE",
        help="Record output to the given video file",
    )
    parser.add_argument(
        "--min-area",
        type=int,
        default=500,
        help="Minimum contour area (pixels) to count as motion (default: 500)",
    )
    parser.add_argument(
        "--camera",
        type=int,
        default=0,
        help="Camera device index (default: 0)",
    )
    parser.add_argument(
        "--width",
        type=int,
        default=640,
        help="Capture width (default: 640)",
    )
    parser.add_argument(
        "--height",
        type=int,
        default=480,
        help="Capture height (default: 480)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    cap = cv2.VideoCapture(args.camera)
    if not cap.isOpened():
        print(f"Error: Could not open camera at index {args.camera}")
        return

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, args.width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, args.height)

    actual_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    actual_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    print(f"Camera opened: {actual_w}x{actual_h} @ ~{cap.get(cv2.CAP_PROP_FPS):.0f} FPS")

    writer: cv2.VideoWriter | None = None
    if args.record:
        fourcc = cv2.VideoWriter_fourcc(*"avc1")
        writer = cv2.VideoWriter(args.record, fourcc, 20.0, (actual_w, actual_h))
        if not writer.isOpened():
            print("Warning: Could not open video writer (trying mp4v fallback)")
            fourcc = cv2.VideoWriter_fourcc(*"mp4v")
            writer = cv2.VideoWriter(args.record, fourcc, 20.0, (actual_w, actual_h))
        print(f"Recording to: {args.record}")

    # MOG2 adapts to lighting changes better than frame differencing
    back_sub = cv2.createBackgroundSubtractorMOG2(
        history=500, varThreshold=36, detectShadows=True
    )

    prev_time = time.perf_counter()
    fps = 0.0

    print("Press 'q' to quit.")

    while True:
        ret, frame = cap.read()
        if not ret:
            print("Error: Failed to grab frame")
            break

        fg_mask = back_sub.apply(frame)

        blurred = cv2.GaussianBlur(fg_mask, (5, 5), 0)
        _, thresh = cv2.threshold(blurred, 200, 255, cv2.THRESH_BINARY)
        dilated = cv2.dilate(thresh, None, iterations=2)

        contours, _ = cv2.findContours(
            dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )

        motion_count = 0
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < args.min_area:
                continue

            x, y, w, h = cv2.boundingRect(cnt)
            cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2)
            cv2.putText(
                frame,
                f"Motion",
                (x, y - 6),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (0, 255, 0),
                1,
            )
            motion_count += 1

        now = time.perf_counter()
        dt = now - prev_time
        fps = 0.9 * fps + 0.1 / dt if dt > 0 else fps
        prev_time = now

        cv2.putText(
            frame,
            f"FPS: {fps:.1f}  |  Objects: {motion_count}",
            (10, 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 255, 255),
            2,
        )

        # Show the foreground mask in a small inset for debugging
        mask_display = cv2.cvtColor(dilated, cv2.COLOR_GRAY2BGR)
        inset = cv2.resize(mask_display, (160, 120))
        frame[0:120, 0:160] = inset

        if writer:
            writer.write(frame)

        cv2.imshow("Motion Track (q to quit)", frame)

        key = cv2.waitKey(1) & 0xFF
        if key == ord("q"):
            break

    cap.release()
    if writer:
        writer.release()
    cv2.destroyAllWindows()
    print("Done.")


if __name__ == "__main__":
    main()
