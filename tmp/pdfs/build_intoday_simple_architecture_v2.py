from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor, white
import math

OUT = 'output/pdf/intoday-simple-architecture.pdf'
pdfmetrics.registerFont(TTFont('NotoSC', r'C:\Windows\Fonts\NotoSansSC-VF.ttf'))
W, H = landscape(A4)
NAVY=HexColor('#12203A'); SLATE=HexColor('#56657A'); BLUE=HexColor('#2563EB'); BLUE_L=HexColor('#EAF2FF')
PURPLE=HexColor('#7C3AED'); PURPLE_L=HexColor('#F2EBFF'); ORANGE=HexColor('#EA580C'); ORANGE_L=HexColor('#FFF0E6')
GREEN=HexColor('#059669'); GREEN_L=HexColor('#E5F8F0'); LINE=HexColor('#D9E1EC'); BG=HexColor('#F8FAFD')

def txt(c,s,x,y,size=10,color=NAVY,align='center'):
    c.setFont('NotoSC',size); c.setFillColor(color)
    {'left':c.drawString,'right':c.drawRightString,'center':c.drawCentredString}[align](x,y,s)

def box(c,x,y,w,h,title,lines,fill,stroke):
    c.setFillColor(fill); c.setStrokeColor(stroke); c.setLineWidth(1.4); c.roundRect(x,y,w,h,14,fill=1,stroke=1)
    txt(c,title,x+w/2,y+h-29,14,stroke)
    for i,line in enumerate(lines): txt(c,line,x+w/2,y+h-51-i*15,8.7,SLATE)

def arrow(c,x1,y1,x2,y2,color,label=None):
    c.saveState(); c.setStrokeColor(color); c.setFillColor(color); c.setLineWidth(1.8); c.line(x1,y1,x2,y2)
    a=math.atan2(y2-y1,x2-x1)
    for d in (2.55,-2.55): c.line(x2,y2,x2-8*math.cos(a+d),y2-8*math.sin(a+d))
    c.restoreState()
    if label: txt(c,label,(x1+x2)/2,(y1+y2)/2+8,8,color)

def group(c,x,y,w,h,label,color):
    c.saveState(); c.setStrokeColor(color); c.setLineWidth(1); c.setDash(5,4); c.roundRect(x,y,w,h,15,fill=0,stroke=1); c.restoreState()
    c.setFillColor(BG); c.rect(x+13,y+h-7,130,15,fill=1,stroke=0); txt(c,label,x+20,y+h-3,9,color,align='left')

def build():
    c=canvas.Canvas(OUT,pagesize=landscape(A4)); c.setTitle('IntoDay - Simple Architecture')
    c.setFillColor(BG); c.rect(0,0,W,H,fill=1,stroke=0)
    txt(c,'IntoDay 技术架构',42,H-49,26,NAVY,align='left')
    txt(c,'面试介绍版：从访问、认证、业务功能到数据同步的一条主流程',43,H-70,9.5,SLATE,align='left')

    # Main application request path.
    group(c,38,258,106,145,'访问与部署',BLUE)
    box(c,57,312,68,62,'用户',['浏览器'],BLUE_L,BLUE)
    txt(c,'Vercel',91,279,13,BLUE); txt(c,'静态站点 / PWA / API',91,264,7.3,SLATE)
    arrow(c,91,312,91,286,BLUE,'访问')

    group(c,167,258,423,145,'React + Vite 单页应用',PURPLE)
    box(c,190,309,105,70,'App 入口',['main.jsx','App.jsx：登录门控'],PURPLE_L,PURPLE)
    box(c,330,309,113,70,'DesktopApp',['页面状态与业务协调','Canvas / Inbox / Pack'],PURPLE_L,PURPLE)
    box(c,480,309,86,70,'交互层',['拖拽','碰撞判断'],PURPLE_L,PURPLE)
    arrow(c,144,278,190,344,BLUE,'加载')
    arrow(c,295,344,330,344,PURPLE,'已登录')
    arrow(c,443,344,480,344,PURPLE)

    group(c,621,258,183,145,'Supabase',GREEN)
    box(c,643,309,139,70,'Auth',['Google OAuth','Session'],GREEN_L,GREEN)
    arrow(c,295,362,643,362,GREEN,'认证与 Session')

    # Separate, readable data flow: DesktopApp -> sync hook -> browser -> Postgres.
    group(c,167,104,198,108,'任务数据：本地优先',ORANGE)
    box(c,184,123,164,61,'useSyncedTodos',['先写本地','350ms 后同步'],ORANGE_L,ORANGE)
    arrow(c,387,309,266,184,ORANGE,'任务变更')

    group(c,407,104,182,108,'浏览器本地持久化',ORANGE)
    box(c,425,123,146,61,'浏览器存储',['localStorage：任务 / 工作区','IndexedDB：上传 Blob'],ORANGE_L,ORANGE)
    arrow(c,348,154,425,154,ORANGE,'立即保存')

    group(c,621,104,183,108,'云端任务数据库',GREEN)
    box(c,643,123,139,61,'Postgres todos',['任务 payload','RLS 用户隔离'],GREEN_L,GREEN)
    arrow(c,348,143,643,143,GREEN,'登录后恢复 / 自动同步')

    c.setFillColor(white); c.setStrokeColor(LINE); c.roundRect(38,36,766,45,10,fill=1,stroke=1)
    txt(c,'一句话说明：IntoDay 是 local-first 的 React 应用；任务数据同步到 Supabase，但 Workspace 与上传文件目前以浏览器本地存储为主。',58,59,9,NAVY,align='left')
    txt(c,'Canvas 使用 DOM 卡片与原生 Pointer Events，不是 HTML Canvas。',58,45,8.2,SLATE,align='left')
    c.showPage(); c.save()

if __name__=='__main__': build()
