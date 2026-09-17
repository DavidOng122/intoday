from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor, white
import math

OUT = 'output/pdf/intoday-simple-architecture.pdf'
pdfmetrics.registerFont(TTFont('NotoSC', r'C:\Windows\Fonts\NotoSansSC-VF.ttf'))

W, H = landscape(A4)
NAVY = HexColor('#12203A')
SLATE = HexColor('#56657A')
BLUE = HexColor('#2563EB')
BLUE_L = HexColor('#EAF2FF')
PURPLE = HexColor('#7C3AED')
PURPLE_L = HexColor('#F2EBFF')
ORANGE = HexColor('#EA580C')
ORANGE_L = HexColor('#FFF0E6')
GREEN = HexColor('#059669')
GREEN_L = HexColor('#E5F8F0')
LINE = HexColor('#D9E1EC')
BG = HexColor('#F8FAFD')

def txt(c, value, x, y, size=10, color=NAVY, align='center'):
    c.setFont('NotoSC', size)
    c.setFillColor(color)
    if align == 'left': c.drawString(x, y, value)
    elif align == 'right': c.drawRightString(x, y, value)
    else: c.drawCentredString(x, y, value)

def box(c, x, y, w, h, title, desc, fill, stroke):
    c.setFillColor(fill); c.setStrokeColor(stroke); c.setLineWidth(1.4)
    c.roundRect(x, y, w, h, 13, fill=1, stroke=1)
    txt(c, title, x+w/2, y+h-30, 14, stroke)
    rows = desc if isinstance(desc, list) else [desc]
    for i, row in enumerate(rows):
        txt(c, row, x+w/2, y+h-52-i*15, 8.5, SLATE)

def arrow(c, x1, y1, x2, y2, color, label=None, dashed=False):
    c.saveState(); c.setStrokeColor(color); c.setFillColor(color); c.setLineWidth(1.8)
    if dashed: c.setDash(5, 4)
    c.line(x1,y1,x2,y2)
    angle=math.atan2(y2-y1,x2-x1)
    for d in (2.55,-2.55):
        c.line(x2,y2,x2-8*math.cos(angle+d),y2-8*math.sin(angle+d))
    c.restoreState()
    if label: txt(c,label,(x1+x2)/2,(y1+y2)/2+8,8,color)

def group(c,x,y,w,h,label,color):
    c.saveState(); c.setStrokeColor(color); c.setLineWidth(1); c.setDash(5,4)
    c.roundRect(x,y,w,h,15,fill=0,stroke=1); c.restoreState()
    c.setFillColor(BG); c.rect(x+14,y+h-7,100,15,fill=1,stroke=0)
    txt(c,label,x+20,y+h-3,9,color,align='left')

def build():
    c=canvas.Canvas(OUT,pagesize=landscape(A4)); c.setTitle('IntoDay - Simple Architecture')
    c.setFillColor(BG); c.rect(0,0,W,H,fill=1,stroke=0)
    txt(c,'IntoDay 技术架构',42,H-49,26,NAVY,align='left')
    txt(c,'面试介绍版：一条主数据流，说明本地优先与云端同步的边界',43,H-70,9.5,SLATE,align='left')

    # four main domains
    group(c,35,155,105,265,'用户与部署',BLUE)
    group(c,164,155,310,265,'React + Vite 前端',PURPLE)
    group(c,500,155,130,265,'浏览器本地',ORANGE)
    group(c,656,155,150,265,'Supabase',GREEN)

    box(c,55,300,65,65,'用户','浏览器',BLUE_L,BLUE)
    box(c,55,190,65,65,'Vercel',['静态站点','PWA / API'],BLUE_L,BLUE)
    arrow(c,87,300,87,255,BLUE,'访问')

    box(c,186,311,116,67,'App 入口',['main.jsx','App.jsx: Auth Gate'],PURPLE_L,PURPLE)
    box(c,335,311,116,67,'DesktopApp',['主要业务协调层','页面状态 + 行为'],PURPLE_L,PURPLE)
    arrow(c,140,223,186,345,BLUE)
    arrow(c,302,345,335,345,PURPLE)

    box(c,186,205,116,66,'Feature 模块',['Canvas / Capture / Inbox','Pack / Workspace / Search'],white,PURPLE)
    box(c,335,205,116,66,'交互逻辑',['Pointer Events 拖拽','自定义矩形碰撞'],white,PURPLE)
    arrow(c,393,311,244,271,PURPLE)
    arrow(c,393,311,393,271,PURPLE)

    # Sync is a single plain band, avoiding a busy extra box.
    txt(c,'useSyncedTodos：本地先写入，350ms 后同步任务数据',318,177,9,PURPLE)

    box(c,520,300,90,65,'localStorage',['todos','workspaces'],ORANGE_L,ORANGE)
    box(c,520,190,90,65,'IndexedDB',['上传文件 Blob','仅本机保存'],ORANGE_L,ORANGE)
    arrow(c,244,205,520,332,ORANGE,'任务先存本地')
    arrow(c,244,205,520,222,ORANGE,'文件')

    box(c,683,300,96,65,'Auth',['Google OAuth','Session'],GREEN_L,GREEN)
    box(c,683,190,96,65,'Postgres',['todos','RLS 用户隔离'],GREEN_L,GREEN)
    arrow(c,302,345,683,332,GREEN,'登录 / Session')
    arrow(c,302,205,683,222,GREEN,'任务同步')

    # Mini feature boundary note
    c.setFillColor(white); c.setStrokeColor(LINE); c.roundRect(35,62,771,65,10,fill=1,stroke=1)
    txt(c,'面试要点',55,102,11,NAVY,align='left')
    txt(c,'1. Canvas 是 DOM 卡片，不是 HTML Canvas。',55,85,8.7,SLATE,align='left')
    txt(c,'2. 任务数据会恢复与同步；Workspace 和上传 Blob 目前主要是浏览器本地数据。',55,72,8.7,SLATE,align='left')
    txt(c,'3. Supabase 负责 Google 登录、Session 和 todos 数据库；RLS 限制为当前用户自己的记录。',55,59,8.7,SLATE,align='left')
    txt(c,'基于当前 repository 实作',785,72,7.5,SLATE,align='right')

    c.showPage(); c.save()

if __name__=='__main__': build()
