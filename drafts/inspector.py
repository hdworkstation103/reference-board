from dataclasses import dataclass
from typing import Optional


@dataclass
class NodeSource:
    url: Optional[str]
    embedded_data: Optional[str]


@dataclass
class MediaNode:
    id: int
    name: str
    media_kind: str  # "image" | "video" | "note"
    src: str
    source: NodeSource
    is_gif: bool
    paused: bool
    gif_freeze_src: Optional[str]


@dataclass
class IntrinsicSize:
    width: int
    height: int


@dataclass
class InspectorRow:
    label: str
    value: str
    is_link: bool = False

@dataclass
class BoolParameter:
    label: str
    value: bool
    default: bool = False

@dataclass
class IntParameter:
    label: str = "Integer"
    default: int = 0
    min:int = 0
    max:int = 1
    value: int

@dataclass
class Tools:
    selected_node: Optional[MediaNode]

    def flip_image_horizontal(self, value:BoolParameter):
        # logic to flip image horizontally
        # based on the current state of
        # the BoolParameter located on the
        # inspector panel

@dataclass
class InspectorSidebar:
    selected_node: Optional[MediaNode]
    intrinsic_size: Optional[IntrinsicSize]

    def load_intrinsic_size(self, node: MediaNode) -> None:
        """Loads real media dimensions from the source file/URL metadata."""
        pass

    def estimate_file_size(self, node: MediaNode) -> str:
        """Returns estimated embedded size, otherwise 'Unknown'."""
        pass

    def get_source_value(self, node: MediaNode) -> str:
        """Returns URL, 'Embedded', or 'Unknown'."""
        pass

    def get_metadata_rows(self, node: MediaNode) -> list[InspectorRow]:
        """Builds rows: Filename, Width, Height, File Size, Source."""
        pass

    def render_preview(self, node: MediaNode):
        """Renders image/video preview, or note placeholder."""
        pass

    def render_empty_state(self):
        return rx.text("Select a node to inspect it.")

    def render(self):
        if self.selected_node is None:
            return rx.aside(
                rx.heading("Inspector"),
                self.render_empty_state(),
            )

        rows = self.get_metadata_rows(self.selected_node)
        return rx.aside(
            rx.heading("Inspector"),
            self.render_preview(self.selected_node),
            rx.foreach(
                rows,
                lambda row: rx.hstack(
                    rx.text(row.label),
                    rx.cond(
                        row.is_link,
                        rx.link(row.value, href=row.value, is_external=True),
                        rx.text(row.value),
                    ),
                ),
            ),
        )


@dataclass
class AppLayout:
    inspector_width: int = 300

    def on_inspector_resize_start(self, pointer_x: int) -> None:
        pass

    def on_inspector_resize_move(self, pointer_x: int) -> None:
        """Adjusts inspector width with min/max clamps."""
        pass

    def on_inspector_resize_end(self) -> None:
        pass

    def render(self):
        return rx.grid(
            board_viewport(),
            inspector_resize_handle(),
            InspectorSidebar(...).render(),
            columns="1fr 8px var(--inspector-width)",
        )
