from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "src" / "assets"
SIZE = 1024


def rounded_line(draw: ImageDraw.ImageDraw, points, fill, width):
    draw.line(points, fill=fill, width=width, joint="curve")
    radius = width // 2
    for x, y in (points[0], points[-1]):
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=fill)


def create_icon():
    ASSETS.mkdir(parents=True, exist_ok=True)
    image = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    navy = (10, 20, 35, 255)
    navy_2 = (17, 31, 49, 255)
    slate = (43, 64, 80, 255)
    orange = (255, 142, 43, 255)
    orange_2 = (238, 99, 34, 255)
    teal = (58, 210, 194, 255)
    cream = (238, 244, 239, 255)

    draw.rounded_rectangle((36, 36, 988, 988), radius=220, fill=navy)
    draw.rounded_rectangle((58, 58, 966, 966), radius=200, outline=slate, width=14)

    # Quiet contour lines evoke terrain without becoming noisy at small sizes.
    for inset, color in ((130, navy_2), (190, (20, 37, 56, 255)), (250, navy_2)):
        draw.rounded_rectangle(
            (inset, inset, SIZE - inset, SIZE - inset),
            radius=175,
            outline=color,
            width=10,
        )

    # Construction badge.
    badge = [(512, 116), (848, 310), (848, 698), (512, 892), (176, 698), (176, 310)]
    draw.polygon(badge, fill=orange)
    inner = [(512, 158), (811, 331), (811, 677), (512, 850), (213, 677), (213, 331)]
    draw.polygon(inner, fill=navy_2)

    # Horizon and engineered bridge.
    draw.polygon([(250, 478), (378, 337), (488, 456), (586, 358), (773, 520), (250, 520)], fill=teal)
    draw.rounded_rectangle((242, 488, 782, 552), radius=28, fill=cream)
    draw.rounded_rectangle((280, 516, 744, 572), radius=24, fill=orange_2)

    # Road in perspective.
    draw.polygon([(428, 548), (596, 548), (707, 788), (317, 788)], fill=(29, 42, 55, 255))
    rounded_line(draw, [(414, 556), (300, 794)], orange, 28)
    rounded_line(draw, [(610, 556), (724, 794)], orange, 28)
    for y, width in ((596, 18), (662, 24), (739, 30)):
        center = 512
        rounded_line(draw, [(center, y - width), (center, y + width)], cream, 18)

    image.save(ASSETS / "app-icon.png")
    image.save(
        ASSETS / "app-icon.ico",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )


if __name__ == "__main__":
    create_icon()
