from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor, white

OUT = 'output/pdf/intoday-current-architecture.pdf'
FONT = r'C:\Windows\Fonts\NotoSansSC-VF.ttf'

pdfmetrics.registerFont(TTFont('NotoSC', FONT))

PAGE_W, PAGE_H = landscape(A4)

NAVY = HexColor('#0F172A')
SLATE = HexColor('#475569')
LINE = HexColor('#CBD5E1')
BLUE = HexColor('#2563EB')
BLUE_L = HexColor('#DBEAFE')
GREEN = HexColor('#059669')
GREEN_L = HexColor('#D1FAE5')
PURPLE = HexColor('#7C3AED')
PURPLE_L = HexColor('#EDE9FE')
ORANGE = HexColor('#EA580C')
ORANGE_L = HexColor('#FFEDD5')
GRAY_L = HexColor('#F8FAFC')


def text(c, s, x, y, size=9, color=NAVY, bold=False, align='center'):
    c.setFont('NotoSC', size)
    c.setFillColor(color)
    if align == 'center':
        c.drawCentredString(x, y, s)
    elif align == 'left':
        c.drawString(x, y, s)
    else:
        c.drawRightString(x, y, s)


def rounded_box(c, x, y, w, h, title, lines, fill=white, stroke=LINE, title_color=NAVY):
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(1)
    c.roundRect(x, y, w, h, 9, fill=1, stroke=1)
    text(c, title, x + w / 2, y + h - 20, 10, title_color)
    current = y + h - 37
    for line in lines:
        text(c, line, x + w / 2, current, 7.4, SLATE)
        current -= 13


def arrow(c, x1, y1, x2, y2, color=SLATE, dashed=False, label=None):
    c.saveState()
    c.setStrokeColor(color)
    c.setFillColor(color)
    c.setLineWidth(1.4)
    if dashed:
        c.setDash(4, 3)
    c.line(x1, y1, x2, y2)
    import math
    angle = math.atan2(y2-y1, x2-x1)
    wing = 6
    for offset in (2.55, -2.55):
        c.line(x2, y2, x2 - wing * math.cos(angle + offset), y2 - wing * math.sin(angle + offset))
    c.restoreState()
    if label:
        text(c, label, (x1+x2)/2, (y1+y2)/2+5, 6.6, color)


def section(c, x, y, w, h, label, color):
    c.setStrokeColor(color)
    c.setLineWidth(1)
    c.setDash(4, 3)
    c.roundRect(x, y, w, h, 12, fill=0, stroke=1)
    c.setDash()
    c.setFillColor(white)
    c.rect(x+12, y+h-8, 100, 15, fill=1, stroke=0)
    text(c, label, x+17, y+h-3, 8, color, align='left')


def build():
    c = canvas.Canvas(OUT, pagesize=landscape(A4))
    c.setTitle('IntoDay - Current Architecture')
    c.setAuthor('IntoDay')
    c.setFillColor(GRAY_L)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    text(c, 'IntoDay 当前技术架构', 40, PAGE_H - 42, 23, NAVY, align='left')
    text(c, 'Interview architecture overview - based on the current repository implementation', 41, PAGE_H - 60, 8.5, SLATE, align='left')
    text(c, 'React + Vite | Local-first sync | Supabase Auth + Postgres', PAGE_W-40, PAGE_H-48, 8, BLUE, align='right')

    # outer zones
    section(c, 28, 80, 91, 375, '用户与部署', BLUE)
    section(c, 136, 80, 415, 375, '浏览器内的 React 应用', PURPLE)
    section(c, 569, 80, 124, 375, '本地持久化', ORANGE)
    section(c, 711, 80, 102, 375, 'Supabase', GREEN)

    # user + deployment
    rounded_box(c, 43, 345, 61, 58, '用户', ['浏览器'], BLUE_L, BLUE, BLUE)
    rounded_box(c, 43, 248, 61, 62, 'Vercel', ['React 静态站点', 'Serverless API', 'PWA 缓存'], BLUE_L, BLUE, BLUE)
    arrow(c, 74, 345, 74, 311, BLUE, label='访问')

    # Application
    rounded_box(c, 154, 351, 102, 58, '入口', ['main.jsx', 'ErrorBoundary'], PURPLE_L, PURPLE, PURPLE)
    rounded_box(c, 282, 351, 112, 58, '认证门控', ['App.jsx', 'Session 订阅'], PURPLE_L, PURPLE, PURPLE)
    rounded_box(c, 420, 351, 112, 58, '业务协调', ['DesktopApp.jsx', '页面状态与行为'], PURPLE_L, PURPLE, PURPLE)
    arrow(c, 256, 380, 282, 380, PURPLE)
    arrow(c, 394, 380, 420, 380, PURPLE)
    arrow(c, 119, 279, 154, 380, BLUE)

    # features
    rounded_box(c, 154, 258, 76, 61, 'Canvas', ['DOM 卡片', '坐标 / 选择'], white, PURPLE, PURPLE)
    rounded_box(c, 243, 258, 76, 61, 'Capture', ['文件 / 链接', '手动输入'], white, PURPLE, PURPLE)
    rounded_box(c, 332, 258, 76, 61, 'Inbox', ['collectionState', '= inbox'], white, PURPLE, PURPLE)
    rounded_box(c, 421, 258, 76, 61, 'Pack', ['任务分组', '空间锚点'], white, PURPLE, PURPLE)
    rounded_box(c, 154, 171, 105, 55, 'Workspace', ['本地工作区状态'], white, PURPLE, PURPLE)
    rounded_box(c, 275, 171, 105, 55, 'Search / Profile', ['搜索、Session、设置'], white, PURPLE, PURPLE)
    rounded_box(c, 396, 171, 119, 55, 'Drag + Geometry', ['Pointer Events', '矩形重叠碰撞'], white, PURPLE, PURPLE)
    arrow(c, 476, 351, 476, 320, PURPLE)
    arrow(c, 458, 351, 281, 319, PURPLE)
    arrow(c, 281, 258, 281, 226, PURPLE)
    arrow(c, 370, 258, 370, 226, PURPLE)
    arrow(c, 459, 258, 459, 226, PURPLE)
    arrow(c, 281, 258, 192, 226, PURPLE)

    # sync services
    rounded_box(c, 154, 101, 154, 48, 'useSyncedTodos', ['local-first, 350ms debounce, hydrate'], PURPLE_L, PURPLE, PURPLE)
    rounded_box(c, 348, 101, 167, 48, 'useDesktopConnections', ['本地队列；云同步为可选功能'], PURPLE_L, PURPLE, PURPLE)
    arrow(c, 192, 171, 231, 149, PURPLE)
    arrow(c, 455, 171, 432, 149, PURPLE)
    arrow(c, 370, 258, 231, 149, PURPLE)
    arrow(c, 459, 258, 432, 149, PURPLE)

    # Local data
    rounded_box(c, 584, 323, 94, 67, 'localStorage', ['todos', 'workspaces', 'connections'], ORANGE_L, ORANGE, ORANGE)
    rounded_box(c, 584, 212, 94, 66, 'IndexedDB', ['上传文件 Blob', '设备本地'], ORANGE_L, ORANGE, ORANGE)
    arrow(c, 308, 125, 584, 356, ORANGE, label='立即持久化')
    arrow(c, 243, 258, 584, 245, ORANGE, label='文件')
    arrow(c, 515, 125, 584, 356, ORANGE, label='本地队列')

    # Supabase
    rounded_box(c, 723, 343, 78, 53, 'Auth', ['Google OAuth', 'Session'], GREEN_L, GREEN, GREEN)
    rounded_box(c, 723, 252, 78, 57, 'todos', ['任务 payload', 'soft delete'], GREEN_L, GREEN, GREEN)
    rounded_box(c, 723, 159, 78, 57, 'connections', ['canvas 关系', 'feature flag'], GREEN_L, GREEN, GREEN)
    rounded_box(c, 723, 100, 78, 30, 'RLS', ['用户隔离'], GREEN_L, GREEN, GREEN)
    arrow(c, 394, 380, 723, 370, GREEN, label='登录 / Session')
    arrow(c, 308, 125, 723, 281, GREEN, label='任务同步')
    arrow(c, 515, 125, 723, 187, GREEN, dashed=True, label='可选云同步')
    arrow(c, 762, 252, 762, 130, GREEN)

    # Key / legend strip
    c.setFillColor(white)
    c.setStrokeColor(LINE)
    c.roundRect(28, 25, 785, 38, 8, fill=1, stroke=1)
    text(c, '关键事实：Workspace 与上传文件目前主要在本地；任务 todos 会同步到 Supabase；连接关系云同步需要开启 VITE_CANVAS_CONNECTIONS_CLOUD_ENABLED。', 48, 42, 8.1, NAVY, align='left')
    text(c, '实线 = 当前默认路径    虚线 = 可选路径', 48, 31, 7.3, SLATE, align='left')
    text(c, '基于仓库当前代码，而非 README 宣传描述', 793, 34, 7.1, SLATE, align='right')

    c.showPage()
    c.save()


if __name__ == '__main__':
    build()
